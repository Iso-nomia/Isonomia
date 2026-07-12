//app/api/evidentialdev/seed-functor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;
const uid = (n = 6) => Math.random().toString(36).slice(2, 2 + n);
const moid = (tag: string) => `seed:${tag}:${Date.now()}:${uid(4)}`; // ✅ real string


export async function GET() { return NextResponse.json({ ok: true }, NO_STORE); }

export async function POST(_req: NextRequest) {
  // ------------------ 0) Two rooms + two deliberations ------------------
  const [roomA, roomB] = await Promise.all([
    prisma.agoraRoom.create({
      data: { slug: `seedA-${Date.now()}-${uid(3)}`, title: 'Functor • Room A', summary: 'Source room (A)' },
      select: { id: true, slug: true, title: true }
    }),
    prisma.agoraRoom.create({
      data: { slug: `seedB-${Date.now()}-${uid(3)}`, title: 'Functor • Room B', summary: 'Target room (B)' },
      select: { id: true, slug: true, title: true }
    })
  ]);

  async function newDelib(roomId: string) {
    // pick the first enum value available at runtime; fallback 'topic'
    const hostTypeAny =
      (Object.values(($Enums as any)?.DeliberationHostType ?? {})[0] as any) || 'topic';
    const d = await prisma.deliberation.create({
      data: {
        hostType: hostTypeAny,
        hostId: `host:${uid(6)}`,
        createdById: 'system',
        rule: 'utilitarian' as any,
        roomId,        // link to AgoraRoom
        agoraRoomId: roomId as any, // tolerate older field if still present
      },
      select: { id: true }
    }).catch(async () => {
      // fallback create if older schema only has roomId
      const dd = await prisma.deliberation.create({
        data: {
          hostType: hostTypeAny, hostId: `host:${uid(6)}`, createdById: 'system', rule: 'utilitarian' as any, roomId
        },
        select: { id: true }
      });
      return dd;
    });
    return d.id;
  }

  const [delibA, delibB] = await Promise.all([newDelib(roomA.id), newDelib(roomB.id)]);

  // ------------------ 1) Claims in A and B (mappable) ------------------
  // Claims in A (✅ add moid)
  const [cPhiA, cPsiA] = await Promise.all([
    prisma.claim.create({
      data: { deliberationId: delibA, createdById: 'system',
              text: 'φ_A: The policy reduces commute duration.', moid: moid('phiA') },
      select: { id: true, text: true }
    }),
    prisma.claim.create({
      data: { deliberationId: delibA, createdById: 'system',
              text: 'ψ_A: The policy improves road safety.', moid: moid('psiA') },
      select: { id: true, text: true }
    }),
  ]);

  // Claims in B (✅ add moid)
  const [cPhiB, cPsiB] = await Promise.all([
    prisma.claim.create({
      data: { deliberationId: delibB, createdById: 'system',
              text: 'φ_B: The policy reduces commute duration.', moid: moid('phiB') },
      select: { id: true, text: true }
    }),
    prisma.claim.create({
      data: { deliberationId: delibB, createdById: 'system',
              text: 'ψ_B: The policy improves road safety.', moid: moid('psiB') },
      select: { id: true, text: true }
    }),
  ]);

  // ------------------ 2) A’s arguments, premises, supports, diagram -----
  const [A0, A1, B1, P1, P2] = await Promise.all([
    prisma.argument.create({
      data: { deliberationId: delibA, authorId: 'system',
              text: 'A0_A: Main composed case for φ_A', claimId: cPhiA.id },
      select: { id: true, text: true }
    }),
    prisma.argument.create({
      data: { deliberationId: delibA, authorId: 'system',
              text: 'A1_A: Independent atomic support for φ_A', claimId: cPhiA.id },
      select: { id: true, text: true }
    }),
    prisma.argument.create({
      data: { deliberationId: delibA, authorId: 'system',
              text: 'B1_A: Atomic support for ψ_A', claimId: cPsiA.id },
      select: { id: true, text: true }
    }),
    prisma.argument.create({
      data: { deliberationId: delibA, authorId: 'system', text: 'P1_A: 2023 data shows 15% reduction' },
      select: { id: true, text: true }
    }),
    prisma.argument.create({
      data: { deliberationId: delibA, authorId: 'system', text: 'P2_A: Mode shift lowers congestion' },
      select: { id: true, text: true }
    }),
  ]);

  await prisma.argumentEdge.createMany({
    data: [
      { deliberationId: delibA, fromArgumentId: P1.id, toArgumentId: A0.id,
        type: 'support' as any, createdById: 'system', targetScope: 'conclusion' as any },
      { deliberationId: delibA, fromArgumentId: P2.id, toArgumentId: A0.id,
        type: 'support' as any, createdById: 'system', targetScope: 'conclusion' as any },
    ],
    skipDuplicates: true,
  });

  await prisma.argumentSupport.createMany({
    data: [
      { deliberationId: delibA, claimId: cPhiA.id, argumentId: A0.id, base: 0.42 },
      { deliberationId: delibA, claimId: cPhiA.id, argumentId: A1.id, base: 0.33 },
      { deliberationId: delibA, claimId: cPsiA.id, argumentId: B1.id, base: 0.26 },
    ],
    skipDuplicates: true,
  });

  // Assumption on A0 (optional)
  await prisma.assumptionUse.create({
    data: { deliberationId: delibA, argumentId: A0.id, weight: 0.78 }
  }).catch(() => {});

  // Diagram for A0: (P1, P2) → A0
  const diagA0 = await prisma.argumentDiagram.create({
    data: {
      title: 'Exhibit A0_A', createdById: 'system',
      statements: {
        create: [
          { text: 'A0_A: Main composed case for φ_A (conclusion)', role: 'conclusion', tags: [] },
          { text: 'P1_A: 2023 data shows 15% reduction', role: 'premise', tags: [] },
          { text: 'P2_A: Mode shift lowers congestion', role: 'premise', tags: [] },
        ]
      }
    },
    select: { id: true, statements: { select: { id: true, text: true, role: true } } }
  });
  {
    const map = new Map(diagA0.statements.map(s => [s.text, s.id]));
    const inf = await prisma.inference.create({
      data: {
        diagramId: diagA0.id, kind: 'defeasible',
        conclusionId: map.get('A0_A: Main composed case for φ_A (conclusion)')!,
        schemeKey: null, cqKeys: []
      }, select: { id: true }
    });
    for (const t of ['P1_A: 2023 data shows 15% reduction', 'P2_A: Mode shift lowers congestion']) {
      await prisma.inferencePremise.create({ data: { inferenceId: inf.id, statementId: map.get(t)! } });
    }
  }

  // ------------------ 3) One sheet per room (quick reader bridges) ------
  const [sheetA, sheetB] = await Promise.all([
    prisma.debateSheet.create({
      data: { title: `Sheet A • ${roomA.slug}`, createdById: 'system',
              deliberation: { connect: { id: delibA } },
              room: { connect: { id: roomA.id } } },
      select: { id: true }
    }),
    prisma.debateSheet.create({
      data: { title: `Sheet B • ${roomB.slug}`, createdById: 'system',
              deliberation: { connect: { id: delibB } },
              room: { connect: { id: roomB.id } } },
      select: { id: true }
    })
  ]);

  await prisma.debateNode.createMany({
    data: [
      // Room A nodes
      { sheetId: sheetA.id, title: cPhiA.text, claimId: cPhiA.id },
      { sheetId: sheetA.id, title: cPsiA.text, claimId: cPsiA.id },
      { sheetId: sheetA.id, title: A0.text, argumentId: A0.id, diagramId: diagA0.id },
      { sheetId: sheetA.id, title: A1.text, argumentId: A1.id },
      { sheetId: sheetA.id, title: B1.text, argumentId: B1.id },
      // Room B nodes (claims only; arguments will be imported)
      { sheetId: sheetB.id, title: cPhiB.text, claimId: cPhiB.id },
      { sheetId: sheetB.id, title: cPsiB.text, claimId: cPsiB.id },
    ] as any,
    skipDuplicates: true,
  });

  // ------------------ 4) Create a RoomFunctor map A→B -------------------
  const claimMap = { [cPhiA.id]: cPhiB.id, [cPsiA.id]: cPsiB.id };
  const functor = await prisma.roomFunctor.upsert({
    where: { fromRoomId_toRoomId: { fromRoomId: delibA, toRoomId: delibB } as any },
    update: { claimMapJson: claimMap, notes: 'Seeded mapping A→B' },
    create: { fromRoomId: delibA, toRoomId: delibB, claimMapJson: claimMap, notes: 'Seeded mapping A→B' },
    select: { id: true }
  }).catch(async () => {
    // if unique constraint alias differs, emulate upsert
    const prev = await prisma.roomFunctor.findFirst({
      where: { fromRoomId: delibA, toRoomId: delibB }, select: { id: true }
    });
    if (prev) {
      const row = await prisma.roomFunctor.update({
        where: { id: prev.id }, data: { claimMapJson: claimMap, notes: 'Seeded mapping A→B' },
        select: { id: true }
      });
      return row;
    }
    const row = await prisma.roomFunctor.create({
      data: { fromRoomId: delibA, toRoomId: delibB, claimMapJson: claimMap, notes: 'Seeded mapping A→B' },
      select: { id: true }
    });
    return row;
  });

  // ------------------ 5) Compute preview proposals (topK=2) -------------
  // Pull supports in A for mapped claims
  const supportsA = await prisma.argumentSupport.findMany({
    where: { deliberationId: delibA, claimId: { in: Object.keys(claimMap) } },
    select: { claimId: true, argumentId: true, base: true }
  });
  const byClaim = new Map<string, { argumentId: string; base: number }[]>();
  for (const s of supportsA) {
    const arr = byClaim.get(s.claimId) ?? [];
    arr.push({ argumentId: s.argumentId, base: s.base ?? 0.55 });
    byClaim.set(s.claimId, arr);
  }
  for (const [k, v] of byClaim) v.sort((a, b) => b.base - a.base);
  const argMeta = await prisma.argument.findMany({
    where: { id: { in: Array.from(new Set(supportsA.map(s => s.argumentId))) } },
    select: { id: true, text: true }
  });
  const textById = new Map(argMeta.map(a => [a.id, a.text || `Argument ${a.id.slice(0,8)}…`]));
  const topK = 2;
  const proposals = Array.from(byClaim.entries()).flatMap(([fromClaimId, list]) => {
    const toClaimId = (claimMap as Record<string,string>)[fromClaimId];
    if (!toClaimId) return [];
    return list.slice(0, topK).map(x => ({
      fromArgumentId: x.argumentId,
      fromClaimId,
      toClaimId,
      base: +(x.base ?? 0.55).toFixed(4),
      previewText: textById.get(x.argumentId) ?? ''
    }));
  });

  // ------------------ 6) Apply: materialize imports in B ----------------
  let applied = 0, skipped = 0;
  for (const p of proposals) {
    // a) create a stub Argument in B (idempotent-ish by text hash)
    const stubText = `Imported (A→B): ${p.previewText}`;
    // If you want stronger idempotency, add a fingerprint; for now, best-effort:
    const existingStub = await prisma.argument.findFirst({
      where: { deliberationId: delibB, text: stubText, claimId: p.toClaimId },
      select: { id: true }
    });
    const stub = existingStub ?? await prisma.argument.create({
      data: {
        deliberationId: delibB, authorId: 'system', text: stubText, claimId: p.toClaimId,
        sources: { fromDeliberationId: delibA, fromArgumentId: p.fromArgumentId } as any
      },
      select: { id: true }
    });

    // b) provenance link (ArgumentImport) if your schema has it
    try {
      const hasImport = await (prisma as any).argumentImport.findFirst({
        where: {
          fromArgumentId: p.fromArgumentId,
          toArgumentId: stub.id,
          fromDeliberationId: delibA,
          toDeliberationId: delibB
        },
        select: { id: true }
      });
      if (!hasImport) {
        await (prisma as any).argumentImport.create({
          data: {
            fromDeliberationId: delibA, toDeliberationId: delibB,
            fromArgumentId: p.fromArgumentId, toArgumentId: stub.id,
            kind: 'import', metaJson: { mappingId: functor.id }
          }
        });
      }
    } catch { /* tolerate missing model shapes */ }

    // c) materialize as ArgumentSupport in B so it shows in /evidential
    const hasSupport = await prisma.argumentSupport.findFirst({
      where: { deliberationId: delibB, claimId: p.toClaimId, argumentId: stub.id },
      select: { id: true }
    });
    if (!hasSupport) {
      await prisma.argumentSupport.create({
        data: { deliberationId: delibB, claimId: p.toClaimId, argumentId: stub.id, base: p.base }
      });
      applied++;
    } else {
      skipped++;
    }
  }

  // ------------------ 7) Response with useful links ---------------------
  return NextResponse.json({
    ok: true,
    functorId: functor.id,
    from: { room: roomA, deliberationId: delibA, sheetId: sheetA.id, claims: { phi: cPhiA.id, psi: cPsiA.id } },
    to:   { room: roomB, deliberationId: delibB, sheetId: sheetB.id, claims: { phi: cPhiB.id, psi: cPsiB.id } },
    proposals: proposals.length, applied, skipped,
    urls: {
      // Room views
      roomA: `/deliberation/${delibA}`,
      roomB: `/deliberation/${delibB}`,
      // Sheets
      sheetA: `/api/sheets/${sheetA.id}`,
      sheetB: `/api/sheets/${sheetB.id}`,
      // Reader aliases (delib-backed)
      sheetA_delib: `/api/sheets/delib:${delibA}`,
      sheetB_delib: `/api/sheets/delib:${delibB}`,
      // Evidential (B shows imported supports now)
      evidentialB_product: `/api/deliberations/${delibB}/evidential?mode=product`,
      evidentialB_min: `/api/deliberations/${delibB}/evidential?mode=min`,
      // Transport page
      transport: `/functor/transport?from=${delibA}&to=${delibB}`,
      // Plexus (imports edges are read to render teal links)
      plexus: `/api/agora/network?scope=public`
    }
  }, NO_STORE);
}
