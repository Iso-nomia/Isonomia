// app/api/deliberations/[id]/arguments/aif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { PaginationQuery, makePage } from '@/lib/server/pagination';
import type { TargetType } from '@prisma/client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

const Query = PaginationQuery.extend({
  claimId: z.string().optional(),
  sort: z.string().optional(), // e.g. createdAt:desc (kept for parity)
});

type AifRow = {
  id: string;
  deliberationId: string;
  authorId: string;
  createdAt: string;
  text: string;
  mediaType: 'text'|'image'|'video'|'audio' | null;

  // AIF meta
  aif: {
    // Legacy single scheme (for backwards compatibility)
    scheme?: { id: string; key: string; name: string; slotHints?: any | null } | null;
    // Phase 4+: Multi-scheme support
    schemes?: Array<{
      id: string;
      key: string;
      name: string;
      slotHints?: any | null;
      role: string;
      isPrimary: boolean;
      confidence: number;
      explicitness: string;
    }>;
    // Phase 5: SchemeNet indicator
    schemeNet?: { id: string; overallConfidence: number } | null;
    preferences?: { preferredBy: number; dispreferredBy: number }; // simple view
    conclusion?: { id: string; text: string } | null;
    premises?: Array<{ id: string; text: string; isImplicit?: boolean }> | null;
    implicitWarrant?: { text?: string } | null;
    attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number };
    cq?: { required: number; satisfied: number };
  };

  // Phase 3: Dialogue Provenance
  dialogueProvenance?: {
    moveId: string;
    moveKind: string;
    speakerName?: string;
  } | null;
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sort: url.searchParams.get('sort') ?? 'createdAt:desc',
    claimId: url.searchParams.get('claimId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
  }
  const { cursor, limit, sort, claimId } = parsed.data;
  const [field, dir] = (sort ?? 'createdAt:desc').split(':') as ['createdAt','asc'|'desc'];

  // Pull the base rows (no expensive includes yet)
  const rows = await prisma.argument.findMany({
    where: {
      deliberationId: params.id,
      ...(claimId ? { conclusionClaimId: claimId } : {}),
    },
    orderBy: [{ [field]: dir }, { id: dir }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, deliberationId: true, authorId: true, createdAt: true,
      text: true, mediaType: true,
      schemeId: true, conclusionClaimId: true,
      implicitWarrant: true,
      // premises relation itself is cheap; we'll hydrate texts in batch below
      premises: { select: { claimId: true, isImplicit: true } },
      // Phase 4+: Multi-scheme support (ArgumentSchemeInstance)
      argumentSchemes: {
        select: {
          schemeId: true,
          role: true,
          isPrimary: true,
          confidence: true,
          explicitness: true,
        },
        orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }]
      },
      // Phase 5: SchemeNet indicator (just check if exists, don't fetch full steps here)
      schemeNet: {
        select: { id: true, overallConfidence: true }
      },
      // Phase 3: Dialogue Provenance
      createdByMoveId: true,
      createdByMove: {
        select: {
          id: true,
          kind: true,
          actorId: true,
        }
      },
    },
  });

  const pageRows = rows.slice(0, limit);

  // after computing: const pageRows = rows.slice(0, limit);
if (pageRows.length === 0) {
  const page = makePage([], limit);
  return NextResponse.json(page, NO_STORE);
}

  // Phase 3: Batch fetch user info for dialogue moves
  const actorIds = Array.from(new Set(
    pageRows
      .map(r => r.createdByMove?.actorId)
      .filter(Boolean) as string[]
  ));
  const actors = actorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: actorIds.map(id => BigInt(id)) } },
        select: { id: true, name: true, username: true }
      })
    : [];
  const actorById = new Map(actors.map(a => [String(a.id), a]));


  // Batch lookup: schemes (+ cqs), claims text for conclusion + premises,
  // attack counts against each argument, and CQ statuses.
  const argIds = pageRows.map(r => r.id);
  // Collect ALL scheme IDs: legacy schemeId + all ArgumentSchemeInstance schemeIds
  const allSchemeIds = Array.from(new Set([
    ...pageRows.map(r => r.schemeId).filter(Boolean) as string[],
    ...pageRows.flatMap(r => (r as any).argumentSchemes?.map((asi: any) => asi.schemeId) || []),
  ]));
  const claimIds = Array.from(new Set([
    ...pageRows.flatMap(r => r.premises.map(p => p.claimId)),
    ...pageRows.map(r => r.conclusionClaimId).filter(Boolean) as string[],
  ]));

  const [schemes, claims, attackCounts, cqStatuses] = await Promise.all([
    allSchemeIds.length
      ? prisma.argumentScheme.findMany({
          where: { id: { in: allSchemeIds } },
          select: {
            id: true, key: true, name: true, slotHints: true,
            cqs: { select: { cqKey: true, text: true, attackType: true, targetScope: true } },
          },
        })
      : Promise.resolve([]),
    claimIds.length
      ? prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id: true, text: true } })
      : Promise.resolve([]),
    // Count attacks AGAINST each argument (edges into toArgumentId)
    prisma.argumentEdge.groupBy({
      by: ['toArgumentId', 'attackType'],
      where: { toArgumentId: { in: argIds } },
      _count: { _all: true },
    }),
    // CQ statuses (support both shapes: argumentId OR (targetType/targetId))
    prisma.cQStatus.findMany({
      where: {
        OR: [
          { argumentId: { in: argIds } },
          { targetType: "argument" as TargetType, targetId: { in: argIds } },
        ],
      },
      select: { argumentId: true, targetId: true, cqKey: true, status: true },
    }),
  ]);

  const schemeById = new Map(schemes.map(s => [s.id, s]));
  const textByClaimId = new Map(claims.map(c => [c.id, c.text ?? '']));


// 1) CA-based attack counts
const caRows = await prisma.conflictApplication.findMany({
  where: {
    deliberationId: params.id,
    OR: [
      { conflictedArgumentId: { in: argIds } },         // undercuts (RA targets)
      { conflictedClaimId: { in: claimIds } },          // rebuts/undermines (I targets)
    ],
  },
  select: {
    conflictedArgumentId: true,
    conflictedClaimId: true,
    legacyAttackType: true,
  },
});

// Build: { argId -> { REBUTS, UNDERCUTS, UNDERMINES } }
const atkByArg: Record<string, { REBUTS: number; UNDERCUTS: number; UNDERMINES: number }> = {};
for (const a of pageRows) atkByArg[a.id] = { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
const premiseIdsByArg = new Map(pageRows.map(r => [r.id, r.premises.map(p => p.claimId)]));

for (const c of caRows) {
  // Decide bucket:
  let bucket: 'REBUTS' | 'UNDERCUTS' | 'UNDERMINES' | null = null;

  if (c.legacyAttackType) {
    bucket = c.legacyAttackType as any;
  } else if (c.conflictedArgumentId) {
    bucket = 'UNDERCUTS'; // CA → RA implies undercut
  } else if (c.conflictedClaimId) {
    // claim could be conclusion (rebut) or a premise (undermine)
    const hitArg = pageRows.find(r => r.conclusionClaimId === c.conflictedClaimId);
    if (hitArg) bucket = 'REBUTS';
    else {
      const argHit = pageRows.find(r => premiseIdsByArg.get(r.id)?.includes(c.conflictedClaimId!));
      if (argHit) {
        atkByArg[argHit.id].UNDERMINES += 1;
        continue;
      }
    }
  }

  if (bucket) {
    // Map the target to an argument row
    if (c.conflictedArgumentId && atkByArg[c.conflictedArgumentId]) {
      atkByArg[c.conflictedArgumentId][bucket] += 1;
    } else if (c.conflictedClaimId) {
      const hitArg = pageRows.find(r => r.conclusionClaimId === c.conflictedClaimId);
      if (hitArg) atkByArg[hitArg.id][bucket] += 1;
    }
  }
}

// 2) Preference counts (preferred/dispreferred by Argument)
const [prefA, dispA] = await Promise.all([
  prisma.preferenceApplication.groupBy({
    by: ['preferredArgumentId'],
    where: { preferredArgumentId: { in: argIds } },
    _count: { _all: true },
  }),
  prisma.preferenceApplication.groupBy({
    by: ['dispreferredArgumentId'],
    where: { dispreferredArgumentId: { in: argIds } },
    _count: { _all: true },
  }),
]);

const preferredBy: Record<string, number> =
  Object.fromEntries(prefA.map(x => [x.preferredArgumentId!, x._count._all]));
const dispreferredBy: Record<string, number> =
  Object.fromEntries(dispA.map(x => [x.dispreferredArgumentId!, x._count._all]));


  // Pack CQ meter per argument
  const cqMap: Record<string, { satisfied: number; seen: Set<string> }> = {};
  for (const s of cqStatuses) {
    const keyArgId = s.argumentId ?? s.targetId ?? '';
    if (!keyArgId) continue;
    cqMap[keyArgId] ??= { satisfied: 0, seen: new Set<string>() };
    if (s.status === 'answered' && s.cqKey && !cqMap[keyArgId].seen.has(s.cqKey)) {
      cqMap[keyArgId].satisfied += 1;
      cqMap[keyArgId].seen.add(s.cqKey);
    }
  }

  // Batch lookup: preferences for each argument
// const prefRows = await prisma.preferenceApplication.groupBy({
//   by: ["argumentId", "preference"],
//   where: { argumentId: { in: argIds } },
//   _count: { _all: true },
// });
//   const prefCounts: {
//     preferredBy: Record<string, number>;
//     dispreferredBy: Record<string, number>;
//   } = {
//     preferredBy: {},
//     dispreferredBy: {},
//   };

//   for (const row of prefRows) {
//     if (row.preference === "preferred") {
//       prefCounts.preferredBy[row.argumentId] = row._count._all;
//     } else if (row.preference === "dispreferred") {
//       prefCounts.dispreferredBy[row.argumentId] = row._count._all;
//     }
//   }
const [prefBy, dispBy] = await Promise.all([
  prisma.preferenceApplication.groupBy({
    by: ['preferredArgumentId'],
    where: { preferredArgumentId: { in: argIds } },
    _count: { _all: true },
  }),
  prisma.preferenceApplication.groupBy({
    by: ['dispreferredArgumentId'],
    where: { dispreferredArgumentId: { in: argIds } },
    _count: { _all: true },
  }),
]);

const preferredByMap = Object.fromEntries(
  prefBy.filter(r => r.preferredArgumentId).map(r => [r.preferredArgumentId as string, r._count._all])
);
const dispreferredByMap = Object.fromEntries(
  dispBy.filter(r => r.dispreferredArgumentId).map(r => [r.dispreferredArgumentId as string, r._count._all])
);

  const items: AifRow[] = pageRows.map(r => {
    const scheme = r.schemeId ? schemeById.get(r.schemeId) : null;
    const required = scheme?.cqs?.length ?? 0;
    const satisfied = cqMap[r.id]?.satisfied ?? 0;
    
    // Phase 3: Dialogue Provenance
    const move = (r as any).createdByMove;
    const dialogueProvenance = move ? {
      moveId: move.id,
      moveKind: move.kind,
      speakerName: actorById.get(move.actorId)?.name || actorById.get(move.actorId)?.username || undefined
    } : null;
    
    // Phase 4+: Multi-scheme support
    const argumentSchemes = ((r as any).argumentSchemes || []).map((asi: any) => {
      const s = schemeById.get(asi.schemeId);
      return s ? {
        id: s.id,
        key: s.key,
        name: s.name ?? "",
        slotHints: s.slotHints ?? null,
        role: asi.role,
        isPrimary: asi.isPrimary,
        confidence: asi.confidence,
        explicitness: asi.explicitness,
      } : null;
    }).filter(Boolean);
    
    // Phase 5: SchemeNet indicator
    const schemeNet = (r as any).schemeNet ? {
      id: (r as any).schemeNet.id,
      overallConfidence: (r as any).schemeNet.overallConfidence,
    } : null;
    
    return {
      id: r.id,
      deliberationId: r.deliberationId,
      authorId: r.authorId,
      createdAt: r.createdAt.toISOString(),
      text: r.text,
      mediaType: (r.mediaType as any) ?? 'text',
      aif: {
        // Legacy single scheme (for backwards compatibility)
        scheme: scheme
          ? {
              id: scheme.id,
              key: scheme.key,
              name: scheme.name ?? "",
              slotHints: scheme.slotHints ?? null,
            }
          : null,
        // Phase 4+: All assigned schemes (via ArgumentSchemeInstance)
        schemes: argumentSchemes,
        // Phase 5: SchemeNet indicator (sequential composition)
        schemeNet,
        conclusion: r.conclusionClaimId ? { id: r.conclusionClaimId, text: textByClaimId.get(r.conclusionClaimId) ?? "" } : null,
        premises: (r as any).premises.map((p: any) => ({ id: p.claimId, text: textByClaimId.get(p.claimId) ?? "", isImplicit: p.isImplicit ?? false })),
        implicitWarrant: (r.implicitWarrant as any) ?? null,
         attacks: atkByArg[r.id] ?? { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 },
  preferences: {
    preferredBy: preferredBy[r.id] ?? 0,
    dispreferredBy: dispreferredBy[r.id] ?? 0,
  },
  cq: { required, satisfied },

    },
    dialogueProvenance
    }
  });

  const page = makePage(items, limit);
  return NextResponse.json(page, NO_STORE);
}
