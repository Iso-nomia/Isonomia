import { prisma } from '@/lib/prismaclient';

export async function computeAffinityClusters(deliberationId: string, k = 4) {
  // approvals per user → set of claimIds (via promoted arguments)
  const promotedArgs = await prisma.argument.findMany({
    where: { deliberationId, claimId: { not: null } },
    select: { id: true, claimId: true },
  });
  const argToClaim = new Map(promotedArgs.map(a => [a.id, a.claimId!]));

  const approvals = await prisma.argumentApproval.findMany({
    where: { deliberationId },
    select: { userId: true, argumentId: true },
  });

  const users = [...new Set(approvals.map(a => a.userId))];
  if (users.length < k) k = Math.max(2, users.length);

  const userVecs = users.map(uid => {
    const claims = new Set<string>();
    approvals.forEach(a => { if (a.userId === uid) { const cid = argToClaim.get(a.argumentId); if (cid) claims.add(cid); } });
    return { uid, claims };
  });

  // cosine on binary claim vectors (spherical k-means again)
  const universe = [...new Set(promotedArgs.map(a=>a.claimId!))];
  const vecs = userVecs.map(u => {
    const v = new Float32Array(universe.length);
    let ones = 0;
    universe.forEach((cid, j) => { if (u.claims.has(cid)) { v[j] = 1; ones++; } });
    const norm = Math.sqrt(ones) || 1;
    for (let j=0;j<v.length;j++) v[j] /= norm;
    return v;
  });

  // reuse kmeans from topic module (copy the functions or import)
  const topicMod = (await import('./topicClusters')) as {
    kmeansCosine?: (vecs: unknown, k: number, iters: number) => { assign: number[] };
  };
  const { assign } = topicMod.kmeansCosine?.(vecs as any, k, 6)
    // fallback: trivial 1-cluster
    ?? { assign: new Array(vecs.length).fill(0) as number[] };

  // wipe old
  const clusters = await prisma.cluster.findMany({ where: { deliberationId, type: 'affinity' } });
  if (clusters.length) {
    const ids = clusters.map(c=>c.id);
    await prisma.userCluster.deleteMany({ where: { clusterId: { in: ids } } });
    await prisma.cluster.deleteMany({ where: { id: { in: ids } } });
  }

  // create clusters
  const groups = new Map<number, number[]>();
  assign.forEach((g,i)=>{ if(!groups.has(g)) groups.set(g, []); groups.get(g)!.push(i); });

  for (const [g, idxs] of groups.entries()) {
    const label = `Affinity ${g+1}`;
    const c = await prisma.cluster.create({ data: { deliberationId, type: 'affinity', label } });
    const rows = idxs.map(i => ({ clusterId: c.id, userId: users[i], score: 0 }));
    for (let i=0;i<rows.length;i+=200) await prisma.userCluster.createMany({ data: rows.slice(i, i+200), skipDuplicates: true });
  }

  return { k: groups.size };
}
