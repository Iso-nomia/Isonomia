// lib/eval/buildAf.ts
import { prisma } from '@/lib/prismaclient';

export async function buildAF(deliberationId: string) {
  const [args, edges] = await Promise.all([
    prisma.argument.findMany({ where: { deliberationId }, include: { premises: true } }),
    prisma.argumentEdge.findMany({ where: { deliberationId } }),
  ]);

  const nodes = args.map(a => a.id);

  // index helpers
  const byConc = new Map<string,string[]>(
    Object.entries(args.reduce((m:any,a)=>{ if (a.conclusionClaimId) (m[a.conclusionClaimId] ??= []).push(a.id); return m; }, {}))
  );
  const usesPrem = new Map<string,string[]>(
    Object.entries(args.reduce((m:any,a)=>{ for (const p of a.premises) (m[p.claimId] ??= []).push(a.id); return m; }, {}))
  );

  const attacks: [string,string][] = [];
  for (const e of edges) {
    if (e.targetScope === 'inference' && e.toArgumentId) {
      attacks.push([e.fromArgumentId, e.toArgumentId]);            // undercut → attacker → target RA
    } else if (e.targetScope === 'premise' && e.targetPremiseId) {
      for (const host of (usesPrem.get(e.targetPremiseId) ?? []))   // undermine → attacker → any RA using that premise
        attacks.push([e.fromArgumentId, host]);
    } else if (e.targetScope === 'conclusion' && e.targetClaimId) {
      for (const host of (byConc.get(e.targetClaimId) ?? []))       // rebut → attacker → any RA concluding that claim
        attacks.push([e.fromArgumentId, host]);
    }
  }

  return { nodes, attacks };
}
