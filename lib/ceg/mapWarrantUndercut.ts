// lib/ceg/mapWarrantUndercut.ts
import { prisma } from '@/lib/prismaclient';
import { recomputeGroundedForDelib } from './grounded';

/**
 * Create an UNDERCUTS edge from `counterClaimId` to `targetClaimId`,
 * marking it as an attack on the target's warrant/backing.
 */
export async function createWarrantUndercut(counterClaimId: string, targetClaimId: string) {
  const target = await prisma.claim.findUnique({ where: { id: targetClaimId }, select: { deliberationId: true } });
  const edge = await prisma.claimEdge.create({
    data: {
      fromClaimId: counterClaimId,
      toClaimId: targetClaimId,
      type: 'rebuts',           // Dung attack
      attackType: 'UNDERCUTS',  // specific kind
      deliberationId: target?.deliberationId ?? null,
    } as any,
  });
  await recomputeGroundedForDelib(target?.deliberationId ?? null);
  return edge.id;
}
