// scripts/backfill-ca-from-edges.ts (run in a one-off migration step)
import { prisma } from '@/lib/prismaclient';

export async function backfillCA(deliberationId: string) {
  // 1) Fetch edges to translate
  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId, attackType: { in: ['REBUTS','UNDERCUTS','UNDERMINES'] as any } },
    select: {
      id: true, attackType: true, fromArgumentId: true, toArgumentId: true,
      targetClaimId: true, targetPremiseId: true, cqKey: true, createdById: true
    }
  });

  for (const e of edges) {
    const attacker = await prisma.argument.findUnique({
      where: { id: e.fromArgumentId }, select: { id: true, conclusionClaimId: true }
    });

    if (e.attackType === 'UNDERCUTS') {
      await prisma.conflictApplication.upsert({
        where: { id: `ca_${e.id}` }, // synthetic stable id
        update: {},
        create: {
          id: `ca_${e.id}`,
          deliberationId, createdById: e.createdById,
          schemeId: null, cqKey: e.cqKey ?? null,
          conflictingKind: 'RA', conflictingArgumentId: attacker?.id ?? null, conflictingClaimId: null,
          conflictedKind: 'RA', conflictedArgumentId: e.toArgumentId, conflictedClaimId: null,
        }
      });
      continue;
    }

    if (e.attackType === 'REBUTS') {
      await prisma.conflictApplication.upsert({
        where: { id: `ca_${e.id}` },
        update: {},
        create: {
          id: `ca_${e.id}`,
          deliberationId, createdById: e.createdById, schemeId: null, cqKey: e.cqKey ?? null,
          conflictingKind: 'CLAIM', conflictingClaimId: attacker?.conclusionClaimId ?? null, conflictingArgumentId: null,
          conflictedKind: 'CLAIM', conflictedClaimId: e.targetClaimId, conflictedArgumentId: null,
        }
      });
      continue;
    }

    if (e.attackType === 'UNDERMINES') {
      await prisma.conflictApplication.upsert({
        where: { id: `ca_${e.id}` },
        update: {},
        create: {
          id: `ca_${e.id}`,
          deliberationId, createdById: e.createdById, schemeId: null, cqKey: e.cqKey ?? null,
          conflictingKind: 'CLAIM', conflictingClaimId: attacker?.conclusionClaimId ?? null, conflictingArgumentId: null,
          conflictedKind: 'CLAIM', conflictedClaimId: e.targetPremiseId, conflictedArgumentId: null,
        }
      });
      continue;
    }
  }
}
