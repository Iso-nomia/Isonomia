// lib/topology/topicClusters.ts
import { prisma } from '@/lib/prismaclient';

type Doc = { id: string; text: string; claimId: string | null };
type V = Float32Array;

const STOP = new Set([
  'the','a','an','and','or','but','if','then','so','that','this','of','to','in','on','for','by','with','as','at','from','it','is','are','was','were','be','been','being','which','who','whom','whose','what','when','where','why','how','not','no','yes','do','does','did','done'
]);

function tokenize(s: string): string[] {
  return (s.normalize('NFKC').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => t.length > 2 && !STOP.has(t));
}
function buildVocab(docs: string[], maxTerms = 400): string[] {
  const freq = new Map<string, number>();
  for (const d of docs) for (const t of new Set(tokenize(d))) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, maxTerms).map(([t])=>t);
}
function tfidfMatrix(docs: string[], vocab: string[]): V[] {
  const N = docs.length, M = vocab.length;
  const idf = new Float32Array(M);
  const df = new Uint32Array(M);
  const tsets = docs.map(d => new Set(tokenize(d)));
  for (const ts of tsets) ts.forEach(t => { const j=vocab.indexOf(t); if (j>=0) df[j] += 1; });
  for (let j=0;j<M;j++) idf[j] = Math.log(1 + N / (1 + df[j]));

  return docs.map((d,i) => {
    const toks = tokenize(d);
    const tf = new Float32Array(M);
    for (const t of toks) { const j=vocab.indexOf(t); if (j>=0) tf[j] += 1; }
    let sum = 0;
    for (let j=0;j<M;j++) { tf[j] = tf[j] * idf[j]; sum += tf[j]*tf[j]; }
    // L2 normalize (spherical k-means)
    const norm = Math.sqrt(sum) || 1;
    for (let j=0;j<M;j++) tf[j] /= norm;
    return tf as V;
  });
}
function dot(a: V, b: V): number { let s=0; for (let i=0;i<a.length;i++) s += a[i]*b[i]; return s; }
function add(a: V, b: V) { for (let i=0;i<a.length;i++) a[i]+=b[i]; }
function normalize(a: V) { let s=0; for (let i=0;i<a.length;i++) s += a[i]*a[i]; s=Math.sqrt(s)||1; for (let i=0;i<a.length;i++) a[i]/=s; }

function kmeansCosine(vecs: V[], k: number, iters=8, seed=42): {assign: number[]; centroids: V[]} {
  const N = vecs.length, M = vecs[0]?.length ?? 0;
  if (N===0 || M===0 || k<=0) return { assign: [], centroids: [] };

  // init: pick k spaced indices
  const centroids = Array.from({length: k}, (_,j) => new Float32Array(M) as V);
  const step = Math.max(1, Math.floor(N / k));
  for (let j=0;j<k;j++) centroids[j].set(vecs[Math.min(j*step, N-1)]);
  let assign = new Array<number>(N).fill(0);

  for (let it=0; it<iters; it++) {
    // assign
    for (let i=0;i<N;i++) {
      let best = 0, bestSim = -1;
      for (let j=0;j<k;j++) {
        const s = dot(vecs[i], centroids[j]);
        if (s > bestSim) { bestSim = s; best = j; }
      }
      assign[i] = best;
    }
    // recompute centroids
    const sums = Array.from({length:k}, ()=>new Float32Array(M) as V);
    const counts = new Array<number>(k).fill(0);
    for (let i=0;i<N;i++){ add(sums[assign[i]], vecs[i]); counts[assign[i]]++; }
    for (let j=0;j<k;j++){ if (counts[j]===0) continue; normalize(sums[j]); centroids[j] = sums[j]; }
  }
  return { assign, centroids };
}

function topTermsForCluster(indices: number[], docs: string[], vocab: string[], top=5): string[] {
  const scores = new Float32Array(vocab.length);
  for (const i of indices) for (const t of tokenize(docs[i])) { const j=vocab.indexOf(t); if (j>=0) scores[j]+=1; }
  return [...vocab.keys()]
    .map(j => [j, scores[j]] as const)
    .sort((a,b)=>b[1]-a[1]).slice(0, top)
    .map(([j]) => vocab[j]);
}

export async function computeTopicClusters(deliberationId: string, k = 8) {
  // 1) Load texts (arguments are denser than claims)
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: { id: true, text: true, claimId: true },
    orderBy: { createdAt: 'asc' },
    take: 4000, // guardrail
  });
  const docs: Doc[] = args.map(a => ({ id: a.id, text: a.text, claimId: a.claimId }));

  // edge case: too small
  if (docs.length < Math.max(6, k)) k = Math.max(2, Math.min(4, docs.length));

  // 2) Vectors
  const texts = docs.map(d=>d.text);
  const vocab = buildVocab(texts, 500);
  const X = tfidfMatrix(texts, vocab);

  // 3) Cluster
  const { assign } = kmeansCosine(X, k, 8);

  // 4) Persist: nuke previous topic clusters for this deliberation
  const clusters = await prisma.cluster.findMany({ where: { deliberationId, type: 'topic' } });
  if (clusters.length) {
    const ids = clusters.map(c=>c.id);
    await prisma.argumentCluster.deleteMany({ where: { clusterId: { in: ids } } });
    await prisma.cluster.deleteMany({ where: { id: { in: ids } } });
  }

  // 5) Create clusters + memberships + labels
  const groups = new Map<number, number[]>();
  assign.forEach((g,i)=>{ if(!groups.has(g)) groups.set(g, []); groups.get(g)!.push(i); });

  const createdIds: string[] = [];
  for (const [g, idxs] of groups.entries()) {
    const top = topTermsForCluster(idxs, texts, vocab, 3);
    const label = top.join(' · ') || `Topic ${g+1}`;
    const c = await prisma.cluster.create({
      data: { deliberationId, type: 'topic', label },
    });
    createdIds.push(c.id);

    // memberships
    const rows = idxs.map(i => ({ clusterId: c.id, argumentId: docs[i].id, score: 0 }));
    for (let i=0; i<rows.length; i+=200) {
      await prisma.argumentCluster.createMany({ data: rows.slice(i, i+200), skipDuplicates: true });
    }
  }

  return { k: groups.size, clusterIds: createdIds };
}
