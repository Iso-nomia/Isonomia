import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';
import {
  listableDeliberationWhere,
  filterVisibleDeliberationIds,
  normalizeUserId,
} from '@/lib/deliberations/visibility';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EdgeKind =
  | 'xref'
  | 'overlap'
  | 'stack_ref'
  | 'imports'
  | 'shared_author'
  | 'institutional_pathway'
  | 'pathway_response';
type EdgeRow = {
  from: string;
  to: string;
  kind: EdgeKind;
  weight: number;
  meta?: Record<string, unknown>;
};

const Q = z.object({
  scope: z.enum(['public', 'following']).default('public'),
  maxRooms: z.coerce.number().int().positive().max(500).default(80),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    scope: url.searchParams.get('scope') ?? undefined,
    maxRooms: url.searchParams.get('maxRooms') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { scope, maxRooms } = parsed.data;

  const userId = normalizeUserId(await getCurrentUserId().catch(() => null));

  /* --------------------- 1) Rooms --------------------- */
  let rooms: { id: string; title?: string | null }[] = [];
  try {
    // Visibility: only surface public deliberations (plus the viewer's own) in
    // the Plexus network graph. See lib/deliberations/visibility.ts.
    rooms = await prisma.deliberation.findMany({
      where: listableDeliberationWhere(userId),
      select: { id: true, title: true },
      orderBy: { updatedAt: 'desc' },
      take: maxRooms,
    });
  } catch (err) {
    console.error("[agora/network] Error fetching deliberations:", err);
    // fallback from arguments (should rarely trigger) — still visibility-gated.
    const rows = await prisma.argument.findMany({
      select: { deliberationId: true },
      distinct: ['deliberationId'],
      take: maxRooms,
    });
    const visible = await filterVisibleDeliberationIds(
      rows.map((r) => r.deliberationId),
      userId,
    );
    rooms = rows
      .filter((r) => visible.has(r.deliberationId))
      .map((r) => ({ id: r.deliberationId, title: null }));
  }
  const roomIds = rooms.map((r) => r.id);
  if (!roomIds.length) {
    return NextResponse.json({ scope, version: Date.now(), rooms: [], edges: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  /* ---------------- 2) Per-room summaries -------------- */
  const [argCounts, edgeCounts, labels, debateSheets] = await Promise.all([
    prisma.argument.groupBy({
      by: ['deliberationId'],
      _count: { deliberationId: true },
      where: { deliberationId: { in: roomIds } },
    }).catch(() => [] as any),
    prisma.argumentEdge.groupBy({
      by: ['deliberationId'],
      _count: { deliberationId: true },
      where: { deliberationId: { in: roomIds } },
    }).catch(() => [] as any),
    prisma.claimLabel.findMany({
      where: { deliberationId: { in: roomIds } },
      select: { deliberationId: true, label: true },
    }).catch(() => [] as any),
    prisma.debateSheet.findMany({
      where: { deliberationId: { in: roomIds } },
      select: { id: true, deliberationId: true },
    }).catch(() => [] as any),
  ]);

  const mArgs = new Map<string, number>();
  (argCounts as any[]).forEach(r => mArgs.set(r.deliberationId, r._count?.deliberationId ?? 0));

  const mEdges = new Map<string, number>();
  (edgeCounts as any[]).forEach(r => mEdges.set(r.deliberationId, r._count?.deliberationId ?? 0));

  const accBy = new Map<string, { accepted: number; rejected: number; undecided: number }>();
  (labels as any[]).forEach(r => {
    const b = accBy.get(r.deliberationId) ?? { accepted: 0, rejected: 0, undecided: 0 };
    if (r.label === 'IN') b.accepted++;
    else if (r.label === 'OUT') b.rejected++;
    else b.undecided++;
    accBy.set(r.deliberationId, b);
  });
  
  const mSheets = new Map<string, string>();
  (debateSheets as any[]).forEach((s: any) => mSheets.set(s.deliberationId, s.id));

  /* ---------------- 3) Meta-edges (XR + overlap + 3 new kinds) -------------- */
  const meta: EdgeRow[] = [];

  // A) explicit cross-refs (your generic XRef table). NOTE: model name may be XRef or Xref in your Prisma;
  try {
    const xr = await (prisma as any).xRef.findMany({
      where: { fromId: { in: roomIds }, toId: { in: roomIds } },
      select: { fromId: true, toId: true },
      take: 5000,
    });
    meta.push(...xr.map((x: any) => ({ from: x.fromId, to: x.toId, kind: 'xref' as const, weight: 1 })));
  } catch {
    // Optional fallback: canonical-claim overlap if XRef absent
    try {
const claims = await prisma.claim.findMany({
  where: {
    deliberationId: { in: roomIds },
    NOT: [{ canonicalClaimId: null }],   // ✅ avoids TS error on Nullable filter
  },
  select: { deliberationId: true, canonicalClaimId: true },
});
      const byCanon = new Map<string, string[]>();
      for (const c of claims) {
        if (!c.deliberationId) continue;
        const arr = byCanon.get(c.canonicalClaimId!) ?? [];
        arr.push(c.deliberationId);
        byCanon.set(c.canonicalClaimId!, arr);
      }
      for (const [, list] of byCanon) {
        const uniq = Array.from(new Set(list));
        for (let i = 0; i < uniq.length; i++) {
          for (let j = i + 1; j < uniq.length; j++) {
            meta.push({ from: uniq[i], to: uniq[j], kind: 'overlap', weight: 1 });
          }
        }
      }
    } catch {}
  }

  // B) stack references
  try {
    const srefs = await prisma.stackReference.findMany({
      where: { fromDeliberationId: { in: roomIds }, toDeliberationId: { in: roomIds } },
      select: { fromDeliberationId: true, toDeliberationId: true },
      take: 5000,
    });
    meta.push(...srefs.map(s => ({ from: s.fromDeliberationId, to: s.toDeliberationId, kind: 'stack_ref' as const, weight: 1 })));
  } catch {}

  // C) imports/restatements
  try {
    const imps = await prisma.argumentImport.findMany({
      where: { fromDeliberationId: { in: roomIds }, toDeliberationId: { in: roomIds } },
      select: { fromDeliberationId: true, toDeliberationId: true },
      take: 5000,
    });
    meta.push(...imps.map(s => ({ from: s.fromDeliberationId, to: s.toDeliberationId, kind: 'imports' as const, weight: 1 })));
  } catch {}

  // D) shared authorship weak ties
  try {
    const sa = await prisma.sharedAuthorRoomEdge.findMany({
      where: { fromId: { in: roomIds }, toId: { in: roomIds } },
      select: { fromId: true, toId: true, strength: true },
      take: 5000,
    });
    meta.push(...sa.map(e => ({
      from: e.fromId,
      to: e.toId,
      kind: 'shared_author' as const,
      weight: Math.max(1, Math.round((e.strength ?? 1))),
    })));
  } catch {}

  // E) institutional pathways: deliberation -> institution and institution -> deliberation (response)
  const institutionsById = new Map<
    string,
    {
      id: string;
      name: string;
      kind: string;
      linkedDeliberationId: string | null;
    }
  >();
  try {
    const pathways = await prisma.institutionalPathway.findMany({
      where: { deliberationId: { in: roomIds } },
      select: {
        id: true,
        deliberationId: true,
        institutionId: true,
        status: true,
        currentPacket: {
          select: {
            version: true,
            submissions: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                responses: {
                  orderBy: { respondedAt: 'desc' },
                  take: 1,
                  select: {
                    responseStatus: true,
                    items: { select: { disposition: true } },
                  },
                },
              },
            },
          },
        },
        institution: {
          select: {
            id: true,
            name: true,
            kind: true,
            linkedDeliberationId: true,
          },
        },
      },
      take: 5000,
    });
    for (const p of pathways) {
      institutionsById.set(p.institution.id, {
        id: p.institution.id,
        name: p.institution.name,
        kind: p.institution.kind,
        linkedDeliberationId: p.institution.linkedDeliberationId,
      });
      meta.push({
        from: p.deliberationId,
        to: `inst:${p.institutionId}`,
        kind: 'institutional_pathway',
        weight: 1,
        meta: {
          pathwayId: p.id,
          status: p.status,
          currentPacketVersion: p.currentPacket?.version ?? null,
        },
      });
      const latestResp = p.currentPacket?.submissions[0]?.responses[0];
      if (latestResp) {
        const items = latestResp.items;
        const accepted = items.filter((i) => i.disposition === 'ACCEPTED').length;
        const acceptedRatio = items.length > 0 ? accepted / items.length : 0;
        meta.push({
          from: `inst:${p.institutionId}`,
          to: p.deliberationId,
          kind: 'pathway_response',
          weight: 1,
          meta: {
            pathwayId: p.id,
            responseStatus: latestResp.responseStatus,
            acceptedRatio,
          },
        });
      }
    }
  } catch (err) {
    console.error('[agora/network] pathways fetch failed:', err);
  }

  // Aggregate duplicates across the same (from,to,kind)
  const agg = new Map<string, EdgeRow>();
  for (const e of meta) {
    const k = `${e.from}|${e.to}|${e.kind}`;
    const prev = agg.get(k);
    if (prev) {
      agg.set(k, {
        ...prev,
        weight: prev.weight + e.weight,
        meta: e.meta ?? prev.meta,
      });
    } else {
      agg.set(k, e);
    }
  }

  /* ---------------- 4) Response ---------------- */
  const out = {
    scope,
    version: Date.now(),
    rooms: rooms.map((r) => ({
      id: r.id,
      title: r.title ?? null,
      nArgs: mArgs.get(r.id) ?? 0,
      nEdges: mEdges.get(r.id) ?? 0,
      ...(accBy.get(r.id) ?? { accepted: 0, rejected: 0, undecided: 0 }),
      debateSheetId: mSheets.get(r.id) ?? null,
    })),
    edges: Array.from(agg.values()),
    institutions: Array.from(institutionsById.values()).map((i) => ({
      id: `inst:${i.id}`,
      institutionId: i.id,
      type: 'institution' as const,
      name: i.name,
      kind: i.kind,
      linkedDeliberationId: i.linkedDeliberationId,
    })),
  };

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
