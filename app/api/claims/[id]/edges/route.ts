export const dynamic = "force-dynamic";

// app/api/claims/[id]/edges/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { ClaimAttackType, ClaimEdgeType } from '@prisma/client';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const fromId = params.id;
  const { toClaimId, type, attackType: attackTypeRaw, targetScope } = await req.json();

  if (!toClaimId || !['supports', 'rebuts'].includes(String(type))) {
    return NextResponse.json({ error: 'toClaimId + type required' }, { status: 400 });
  }
  if (toClaimId === fromId) {
    return NextResponse.json({ error: 'cannot link a claim to itself' }, { status: 400 });
  }

  // both claims + same deliberation
  const [fromClaim, toClaim] = await Promise.all([
    prisma.claim.findUnique({ where: { id: fromId }, select: { deliberationId: true } }),
    prisma.claim.findUnique({ where: { id: toClaimId }, select: { deliberationId: true } }),
  ]);
  if (!fromClaim || !toClaim) return NextResponse.json({ error: 'Claim(s) not found' }, { status: 404 });
  if (fromClaim.deliberationId !== toClaim.deliberationId) {
    return NextResponse.json({ error: 'Claims are in different deliberations' }, { status: 400 });
  }
  const deliberationId = fromClaim.deliberationId!;

  const typeEnum: ClaimEdgeType = String(type) === 'rebuts' ? ClaimEdgeType.rebuts : ClaimEdgeType.supports;
  const attackEnum: ClaimAttackType =
    attackTypeRaw
      ? (String(attackTypeRaw).toUpperCase() as keyof typeof ClaimAttackType) in ClaimAttackType
        ? (ClaimAttackType as any)[String(attackTypeRaw).toUpperCase()]
        : (typeEnum === ClaimEdgeType.rebuts ? ClaimAttackType.REBUTS : ClaimAttackType.SUPPORTS)
      : (typeEnum === ClaimEdgeType.rebuts ? ClaimAttackType.REBUTS : ClaimAttackType.SUPPORTS);

  const scope: 'premise' | 'inference' | 'conclusion' | null =
    targetScope ??
    (attackEnum === ClaimAttackType.UNDERCUTS ? 'inference'
      : attackEnum === ClaimAttackType.UNDERMINES ? 'premise'
      : typeEnum === ClaimEdgeType.rebuts ? 'conclusion'
      : null);

  const edge = await prisma.claimEdge.upsert({
    where: {
      unique_from_to_type_attack: {
        fromClaimId: fromId,
        toClaimId,
        type: typeEnum,
        attackType: attackEnum,
      },
    },
    update: { targetScope: scope ?? undefined },
    create: {
      deliberationId,
      fromClaimId: fromId,
      toClaimId,
      type: typeEnum,
      attackType: attackEnum,
      targetScope: scope ?? undefined,
    },
  });

  await recomputeGroundedForDelib(deliberationId);
  return NextResponse.json({ edge });
}
