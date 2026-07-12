//app/api/evidentialdev/seed-evidential/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function uid(n = 6) { return Math.random().toString(36).slice(2, 2 + n); }
function nowSlug(s: string) { return `seed:${s}:${Date.now()}:${uid(4)}`; }
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET() {
  return NextResponse.json({ ok: true }, NO_STORE);
}

export async function POST(_req: NextRequest) {
  // 0) Create a Room first so we can attach everything to it
  const room = await prisma.agoraRoom.create({
    data: {
      slug: `seed-${Date.now()}-${uid(3)}`,
      title: 'Seed Room',
      summary: 'Dev evidential seed',
    },
    select: { id: true, slug: true, title: true },
  });

  // 1) Create (or fallback to) a Deliberation
  let deliberationId: string;
  try {
    const hostTypeAny =
      (Object.values(($Enums as any)?.DeliberationHostType ?? {})[0] as any) ?? 'topic';
    const delib = await prisma.deliberation.create({
      data: {
        hostType: hostTypeAny,      // pick first enum value available at runtime
        hostId: nowSlug('host'),
        createdById: 'system',
        rule: 'utilitarian' as any, // safe default (enum default in your schema)
      },
      select: { id: true },
    });
    deliberationId = delib.id;
  } catch {
    const anyDelib = await prisma.deliberation.findFirst({ select: { id: true } });
    if (!anyDelib) {
      return NextResponse.json(
        { ok: false, error: 'No deliberations and cannot create one (hostType mismatch). Configure DeliberationHostType.' },
        { status: 500, ...NO_STORE },
      );
    }
    deliberationId = anyDelib.id;
  }

  // Attach deliberation → room (supporting both fields if present)
  await prisma.deliberation.update({
    where: { id: deliberationId },
    data: { roomId: room.id, agoraRoomId: room.id } as any,
  }).catch(() => prisma.deliberation.update({
    where: { id: deliberationId },
    data: { roomId: room.id } as any,
  }));

  // 2) Claims φ, ψ (+ a background assumption α)
  const [cPhi, cPsi, cAlpha] = await Promise.all([
    prisma.claim.create({
      data: {
        deliberationId,
        text: 'φ: Seed claim — the policy is beneficial',
        createdById: 'system',
        moid: nowSlug('φ'),
      }, select: { id: true, text: true }
    }),
    prisma.claim.create({
      data: {
        deliberationId,
        text: 'ψ: Secondary seed claim',
        createdById: 'system',
        moid: nowSlug('ψ'),
      }, select: { id: true, text: true }
    }),
    prisma.claim.create({
      data: {
        deliberationId,
        text: 'α: Background assumption holds',
        createdById: 'system',
        moid: nowSlug('α'),
      }, select: { id: true, text: true }
    }),
  ]);

  // 3) Arguments (A0 concludes φ; A1 → φ; B1 → ψ; P1/P2 are premises of A0)
  const [A0, P1, P2, A1, B1] = await Promise.all([
    prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'A0: Main case for φ (composed)', claimId: cPhi.id },
      select: { id: true, text: true },
    }),
    prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'P1: first premise' },
      select: { id: true, text: true },
    }),
    prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'P2: second premise' },
      select: { id: true, text: true },
    }),
    prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'A1: Atomic support for φ', claimId: cPhi.id },
      select: { id: true, text: true },
    }),
    prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'B1: Weak atomic support for ψ', claimId: cPsi.id },
      select: { id: true, text: true },
    }),
  ]);

  // 4) Argument → Argument edges (premises → A0)
  await prisma.argumentEdge.createMany({
    data: [
      { deliberationId, fromArgumentId: P1.id, toArgumentId: A0.id, type: 'support' as any, createdById: 'system', targetScope: 'conclusion' as any },
      { deliberationId, fromArgumentId: P2.id, toArgumentId: A0.id, type: 'support' as any, createdById: 'system', targetScope: 'conclusion' as any },
    ],
    skipDuplicates: true,
  });

  // 5) Evidential supports (base snapshots)
  await prisma.argumentSupport.createMany({
    data: [
      { deliberationId, claimId: cPhi.id, argumentId: A0.id, base: 0.34 },
      { deliberationId, claimId: cPhi.id, argumentId: A1.id, base: 0.35 },
      { deliberationId, claimId: cPsi.id, argumentId: B1.id, base: 0.28 },
    ],
    skipDuplicates: true,
  });

  // 6) Optional assumption use linking α to A0 (ok to ignore if schema differs)
  await prisma.assumptionUse.create({
    data: { deliberationId, argumentId: A0.id, weight: 0.8 },
  }).catch(() => { /* optional in some schemas */ });

  // 7) Persist an ArgumentDiagram for A0 (P1,P2 → A0)
  const diag = await prisma.argumentDiagram.create({
    data: {
      title: 'Exhibit A0',
      createdById: 'system',
      statements: {
        create: [
          { text: 'A0: Main case for φ (conclusion)', role: 'conclusion', tags: [] },
          { text: 'P1: first premise',               role: 'premise',    tags: [] },
          { text: 'P2: second premise',              role: 'premise',    tags: [] },
        ],
      },
    },
    select: { id: true, statements: { select: { id: true, text: true, role: true } } },
  });

  const textToId = new Map(diag.statements.map(s => [s.text, s.id]));
  const inf = await prisma.inference.create({
    data: {
      diagramId: diag.id,
      kind: 'defeasible',
      conclusionId: textToId.get('A0: Main case for φ (conclusion)')!,
      schemeKey: null,
      cqKeys: [],
    },
    select: { id: true },
  });
  for (const pt of ['P1: first premise', 'P2: second premise']) {
    await prisma.inferencePremise.create({
      data: { inferenceId: inf.id, statementId: textToId.get(pt)! },
    });
  }

  // 8) Create a DebateSheet + bridge DebateNodes → this deliberation’s artifacts
const sheet = await prisma.debateSheet.create({
  data: {
    title: `Seed Sheet • ${room.slug}`,
    createdById: 'system',
    deliberation: { connect: { id: deliberationId } }, // if DebateSheet has this relation
    room:         { connect: { id: room.id } },        // <-- use `room`, not `agoraRoom`
  },
  select: { id: true },
});

  await prisma.debateNode.createMany({
    data: [
      // Claims
      { sheetId: sheet.id, title: cPhi.text, claimId: cPhi.id },
      { sheetId: sheet.id, title: cPsi.text, claimId: cPsi.id },
      // Arguments (attach the diagram to A0 node)
      { sheetId: sheet.id, title: A0.text, argumentId: A0.id, diagramId: diag.id },
      { sheetId: sheet.id, title: P1.text, argumentId: P1.id },
      { sheetId: sheet.id, title: P2.text, argumentId: P2.id },
      { sheetId: sheet.id, title: A1.text, argumentId: A1.id },
      { sheetId: sheet.id, title: B1.text, argumentId: B1.id },
    ] as any,
    skipDuplicates: true,
  });

  // 9) Response with useful links
  return NextResponse.json({
    ok: true,
    room: { id: room.id, slug: room.slug, title: room.title },
    deliberationId,
    sheetId: sheet.id,
    urls: {
      roomDebates: `/api/agora/rooms/${room.id}/deliberations`,
      byRoomSheets: `/api/sheets/by-room?room=${deliberationId}`,
      sheet: `/api/sheets/${sheet.id}`,
      delibSheetAlias: `/api/sheets/delib:${deliberationId}`,
      evidential_product: `/api/deliberations/${deliberationId}/evidential?mode=product`,
      evidential_min: `/api/deliberations/${deliberationId}/evidential?mode=min`,
      graph_gate: `/api/deliberations/${deliberationId}/graph?semantics=preferred&confidence=0.6&mode=product`,
    },
    created: {
      claims: [cPhi.id, cPsi.id, cAlpha.id],
      arguments: { A0: A0.id, P1: P1.id, P2: P2.id, A1: A1.id, B1: B1.id },
      diagramId: diag.id,
    },
  }, NO_STORE);
}
