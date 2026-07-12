import { prisma } from '@/lib/prismaclient';

export async function suggestBridges(deliberationId: string, minSize=6) {
  // clusters
  const clusters = await prisma.cluster.findMany({ where: { deliberationId, type: 'topic' }, select: { id: true, label: true } });
  const memberships = await prisma.argumentCluster.findMany({
    where: { clusterId: { in: clusters.map(c=>c.id) } },
    select: { clusterId: true, argumentId: true },
  });
  const argToClaim = new Map((await prisma.argument.findMany({
    where: { id: { in: [...new Set(memberships.map(m=>m.argumentId))] }, claimId: { not: null } },
    select: { id: true, claimId: true }
  })).map(a => [a.id, a.claimId!]));

  const clusterClaims = new Map<string, Set<string>>();
  for (const c of clusters) clusterClaims.set(c.id, new Set<string>());
  memberships.forEach(m => { const cid = argToClaim.get(m.argumentId); if (cid) clusterClaims.get(m.clusterId)!.add(cid); });

  // edges between claims
  const allClaims = [...new Set(Array.from(clusterClaims.values()).flatMap(s => [...s]))];
  const edges = await prisma.claimEdge.findMany({
    where: { deliberationId, fromClaimId: { in: allClaims }, toClaimId: { in: allClaims } },
    select: { fromClaimId: true, toClaimId: true },
  });
  const exists = new Set(edges.map(e => `${e.fromClaimId}->${e.toClaimId}`));

  // pairwise density
  type Gap = { aId: string; bId: string; aLabel: string; bLabel: string; sizeA: number; sizeB: number; density: number; samples: [string,string][] };
  const out: Gap[] = [];
  for (let i=0;i<clusters.length;i++){
    for (let j=i+1;j<clusters.length;j++){
      const A = clusters[i], B = clusters[j];
      const SA = [...(clusterClaims.get(A.id) ?? new Set())];
      const SB = [...(clusterClaims.get(B.id) ?? new Set())];
      if (SA.length < minSize || SB.length < minSize) continue;

      let edgesAB = 0, possible = SA.length * SB.length;
      const samples: [string,string][] = [];
      for (let s=0; s<Math.min(40, SA.length); s++) {
        const a = SA[(s*13) % SA.length];
        const b = SB[(s*17) % SB.length];
        if (exists.has(`${a}->${b}`) || exists.has(`${b}->${a}`)) edgesAB++;
        else samples.push([a,b]); // candidate pair lacking link
      }
      const density = edgesAB / Math.max(1, Math.min(40, SA.length));
      out.push({ aId: A.id, bId: B.id, aLabel: A.label ?? 'A', bLabel: B.label ?? 'B', sizeA: SA.length, sizeB: SB.length, density, samples });
    }
  }
  // lower density = bigger gap; keep top few
  return out.sort((x,y)=>x.density - y.density).slice(0, 6);
}
