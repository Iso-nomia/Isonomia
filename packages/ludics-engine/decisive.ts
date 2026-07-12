import { prisma } from '@/lib/prismaclient';

export async function computeDecisiveChain(trace: { pairs:{posActId:string;negActId:string}[] },
  hint?: { endorsementActId?: string }) {
  if (!trace.pairs.length) return { indices: [] as number[] };

  const acts = await prisma.ludicAct.findMany({
    where: { id: { in: Array.from(new Set(trace.pairs.flatMap(p=>[p.posActId,p.negActId]))) } },
    include: { locus: true },
  });
  const byId = new Map(acts.map(a=>[a.id,a]));
  const used = new Set<number>();

  // Start from last pair; include it
  let i = trace.pairs.length - 1;
  used.add(i);

  // Walk backwards following justifiedByLocus links
  let currentLocus = byId.get(trace.pairs[i].posActId)?.locus?.path ?? '0';
  for (let k = i-1; k >= 0; k--) {
    const p = trace.pairs[k];
    const pos = byId.get(p.posActId);
    const meta = (pos?.metaJson ?? {}) as any;
    const just = meta?.justifiedByLocus as string | undefined;
    if (just && (currentLocus.startsWith(just) || currentLocus === just)) {
      used.add(k);
      currentLocus = byId.get(p.posActId)?.locus?.path ?? currentLocus;
    }
  }

  return { indices: Array.from(used).sort((a,b)=>a-b) };
}
