// lib/ceg/utils.ts
import { prisma } from '@/lib/prismaclient';
import { recomputeGroundedForDelib } from './grounded';

/**
 * Create a support edge between two claims
 */
export async function createSupportEdge(
  fromClaimId: string,
  toClaimId: string,
  confidence: number = 0.7
) {
  const targetClaim = await prisma.claim.findUnique({
    where: { id: toClaimId },
    select: { deliberationId: true },
  });

  if (!targetClaim) {
    throw new Error('Target claim not found');
  }

  const edge = await prisma.claimEdge.create({
    data: {
      fromClaimId,
      toClaimId,
      type: 'supports',
      attackType: 'SUPPORTS',
      deliberationId: targetClaim.deliberationId,
    } as any,
  });

  // Trigger recomputation
  await recomputeGroundedForDelib(targetClaim.deliberationId);
  
  // Emit refresh event
  if (targetClaim.deliberationId) {
    // This would need to be handled via WebSocket in production
    console.log('CEG updated for deliberation:', targetClaim.deliberationId);
  }

  return edge;
}

/**
 * Create a rebuttal edge (direct attack)
 */
export async function createRebuttalEdge(
  fromClaimId: string,
  toClaimId: string
) {
  const targetClaim = await prisma.claim.findUnique({
    where: { id: toClaimId },
    select: { deliberationId: true },
  });

  if (!targetClaim) {
    throw new Error('Target claim not found');
  }

  const edge = await prisma.claimEdge.create({
    data: {
      fromClaimId,
      toClaimId,
      type: 'rebuts',
      attackType: 'REBUTS',
      deliberationId: targetClaim.deliberationId,
    } as any,
  });

  await recomputeGroundedForDelib(targetClaim.deliberationId);
  return edge;
}

/**
 * Get the subgraph around a specific claim (ego network)
 */
export async function getClaimEgoNetwork(
  claimId: string,
  radius: number = 2
) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { deliberationId: true },
  });

  if (!claim?.deliberationId) {
    return { nodes: [], edges: [] };
  }

  // Get all edges for the deliberation
  const allEdges = await prisma.claimEdge.findMany({
    where: { deliberationId: claim.deliberationId },
    select: {
      id: true,
      fromClaimId: true,
      toClaimId: true,
      type: true,
      attackType: true,
    },
  });

  // BFS to find nodes within radius
  const visited = new Set<string>([claimId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: claimId, depth: 0 }];
  
  const edgeMap = new Map<string, string[]>();
  allEdges.forEach(e => {
    if (!edgeMap.has(e.fromClaimId)) edgeMap.set(e.fromClaimId, []);
    if (!edgeMap.has(e.toClaimId)) edgeMap.set(e.toClaimId, []);
    edgeMap.get(e.fromClaimId)!.push(e.toClaimId);
    edgeMap.get(e.toClaimId)!.push(e.fromClaimId);
  });

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= radius) continue;

    const neighbors = edgeMap.get(id) ?? [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    }
  }

  // Get the claims
  const nodes = await prisma.claim.findMany({
    where: { id: { in: Array.from(visited) } },
    select: {
      id: true,
      text: true,
      ClaimLabel: {
        select: { label: true, semantics: true },
      },
    },
  });

  const edges = allEdges.filter(
    e => visited.has(e.fromClaimId) && visited.has(e.toClaimId)
  );

  return {
    nodes: nodes.map(n => ({
      id: n.id,
      type: 'claim' as const,
      label: n.ClaimLabel?.label as 'IN' | 'OUT' | 'UNDEC' | undefined,
      approvals: 0, // Would need to join with approvals
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.fromClaimId,
      target: e.toClaimId,
      type: e.type as 'supports' | 'rebuts',
      attackType: e.attackType as any,
    })),
  };
}