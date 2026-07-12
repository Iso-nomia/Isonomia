export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';
import { getCurrentUserId } from '@/lib/serverutils';
import crypto from 'crypto';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
// import { bus } from '@/lib/bus';
import  bus  from '@/lib/server/bus';


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; cardId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deliberationId = params.id;
    const cardId = params.cardId;
    const { counterClaimId, counterText } = await req.json();

    if (!counterClaimId && !counterText?.trim()) {
      return NextResponse.json({ error: 'counterClaimId or counterText required' }, { status: 400 });
    }

    // 1) Ensure target claim
    const card = await prisma.deliberationCard.findFirst({
      where: { id: cardId, deliberationId },
      select: { claimId: true, claimText: true },
    });
    if (!card) {
      return NextResponse.json({ error: 'Card not found in deliberation' }, { status: 404 });
    }

    let targetClaimId = card.claimId;
    if (!targetClaimId) {
      const moid = mintClaimMoid(card.claimText);
      const claim = await prisma.claim.upsert({
        where: { moid },
        update: {},
        create: {
          text: card.claimText,
          createdById: String(userId),
          deliberationId,
          moid,
        },
      });
      targetClaimId = claim.id;
      await prisma.deliberationCard.update({
        where: { id: cardId },
        data: { claimId: claim.id },
      });
    }

    // 2) Ensure counter claim
    let fromClaimId = counterClaimId;
    if (!fromClaimId && counterText?.trim()) {
      const moid = mintClaimMoid(counterText.trim());
      const counterClaim = await prisma.claim.upsert({
        where: { moid },
        update: {},
        create: {
          text: counterText.trim(),
          createdById: String(userId),
          deliberationId,
          moid,
        },
      });
      fromClaimId = counterClaim.id;
    }

    // 3) Create undercut edge
    const edge = // 3) Create undercut edge (idempotent)
await prisma.claimEdge.upsert({
  where: {
    unique_from_to_type_attack: {
      fromClaimId,
      toClaimId: targetClaimId,
      type: 'rebuts',
      attackType: 'UNDERCUTS',
    },
  },
  update: { targetScope: 'inference' },
  create: {
    deliberationId,
    fromClaimId,
    toClaimId: targetClaimId,
    type: 'rebuts',
    attackType: 'UNDERCUTS',
    targetScope: 'inference',
  },
});

    try {
      await recomputeGroundedForDelib(deliberationId);
    } catch {}

    return NextResponse.json({ ok: true, edgeId: edge.id, targetClaimId });
  } catch (e: any) {
    console.error('[cards/warrant/undercut] failed', e);
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 400 });
  }
}
