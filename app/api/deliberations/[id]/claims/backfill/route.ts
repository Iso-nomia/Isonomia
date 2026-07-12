export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/claims/backfill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
import { maybeUpsertClaimEdgeFromArgumentEdge } from '@/lib/deepdive/claimEdgeHelpers';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';
import { getCurrentUserId } from '@/lib/serverutils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deliberationId = params.id;
  if (!deliberationId) return NextResponse.json({ error: 'Missing deliberationId' }, { status: 400 });

  try {
    // 1) Find args without claimId
    const args = await prisma.argument.findMany({
      where: { deliberationId, claimId: null },
      select: { id: true, text: true },
    });

    let linked = 0;
    let edgesUpserted = 0;
    const errors: Array<{ argId: string; message: string }> = [];

    for (const a of args) {
      try {
        const moid = mintClaimMoid(a.text);
        // 2) Find a claim in same deliberation with same moid
        const claim = await prisma.claim.findFirst({
          where: { deliberationId, moid },
          select: { id: true },
        });
        if (!claim) continue;

        // 3) Link argument → claim
        await prisma.argument.update({ where: { id: a.id }, data: { claimId: claim.id } });
        linked++;


        // EXTRA PASS: materialize claimEdges for EVERY argumentEdge whose ends are promoted
const argEdges = await prisma.argumentEdge.findMany({
    where: { deliberationId },
    select: {
      id: true,
      fromArgumentId: true,
      toArgumentId: true,
    },
  });

  for (const e of argEdges) {
    // Look up claimIds for both ends
    const fromArg = e.fromArgumentId
      ? await prisma.argument.findUnique({ where: { id: e.fromArgumentId }, select: { claimId: true } })
      : null;
    const toArg = e.toArgumentId
      ? await prisma.argument.findUnique({ where: { id: e.toArgumentId }, select: { claimId: true } })
      : null;

    if (fromArg?.claimId && toArg?.claimId) {
      try {
        await maybeUpsertClaimEdgeFromArgumentEdge(e.id);
        edgesUpserted++;
      } catch (err: any) {
        console.error('[backfill] claimEdge sweep failed', e.id, err?.message ?? err);
        errors.push({ argId: `edge:${e.id}`, message: err?.message ?? String(err) });
      }
    }
  }

        // 4) Materialize claimEdges from incident argumentEdges
        const incident = await prisma.argumentEdge.findMany({
          where: { OR: [{ fromArgumentId: a.id }, { toArgumentId: a.id }] },
          select: { id: true },
        });
        for (const e of incident) {
          try {
            await maybeUpsertClaimEdgeFromArgumentEdge(e.id);
            edgesUpserted++;
          } catch (err: any) {
            console.error('[backfill] upsert claimEdge failed', e.id, err?.message ?? err);
            errors.push({ argId: a.id, message: `claimEdge ${e.id}: ${err?.message ?? err}` });
          }
        }
      } catch (err: any) {
        console.error('[backfill] arg failed', a.id, err?.message ?? err);
        errors.push({ argId: a.id, message: err?.message ?? String(err) });
      }
    }

    // 5) Refresh grounded semantics (ignore errors)
    try { await recomputeGroundedForDelib(deliberationId); } catch (e) {
      console.warn('[backfill] grounded recompute failed', (e as any)?.message ?? e);
    }

    return NextResponse.json({ ok: true, deliberationId, scanned: args.length, linked, edgesUpserted, errors });
  } catch (err: any) {
    // Return the message so you can see the cause in the Response body
    console.error('[backfill] fatal', err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

// Optional convenience: allow GET to trigger the same work while developing.
export const GET = POST;
