// app/api/deliberations/[id]/graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Mode = 'product' | 'min';
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const compose = (xs: number[], mode: Mode) => !xs.length ? 0 : (mode === 'min' ? Math.min(...xs) : xs.reduce((a, b) => a * b, 1));
const join    = (xs: number[], mode: Mode) => !xs.length ? 0 : (mode === 'min' ? Math.max(...xs) : 1 - xs.reduce((a, s) => a * (1 - s), 1));

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = new URL(req.url);
  const mode: Mode = (u.searchParams.get('mode') === 'min' ? 'min' : 'product');
  const deliberationId = params.id;

  const claims = await prisma.claim.findMany({ where: { deliberationId }, select: { id: true, text: true } });
  const claimIds = claims.map(c => c.id);

  const conclusions = await prisma.argument.findMany({
    where: { deliberationId, conclusionClaimId: { in: claimIds } },
    select: { id: true, conclusionClaimId: true },
  });
  const conclByClaim = new Map<string, string>(conclusions.map(a => [a.conclusionClaimId!, a.id]));

  const supports = await prisma.argumentSupport.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id: true, claimId: true, argumentId: true, base: true },
  });

  const emptyNodes = claims.map(c => ({
    id: c.id, diagramId: conclByClaim.get(c.id) ?? null, type: 'claim' as const, text: c.text, score: 0, top: [] as Array<{argumentId:string; score:number}>
  }));

  if (!supports.length) {
    return NextResponse.json({
      ok: true, deliberationId, mode,
      support: {}, hom: {}, nodes: emptyNodes, arguments: [],
      meta: { claims: claims.length, supports: 0, edges: 0, conclusions: conclusions.length }
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId, targetScope: { in: ['premise','inference','conclusion'] as any } },
    select: { fromArgumentId: true, toArgumentId: true },
  });

  const byTo = new Map<string, string[]>();
  for (const e of edges) (byTo.get(e.toArgumentId) ?? byTo.set(e.toArgumentId!, []).get(e.toArgumentId!))!.push(e.fromArgumentId);

  const uses = await prisma.assumptionUse.findMany({
    where: { argumentId: { in: supports.map(s => s.argumentId) } },
    select: { argumentId: true, weight: true },
  }).catch(()=>[] as any[]);

  const assumpByArg = new Map<string, number[]>();
  for (const u2 of uses) (assumpByArg.get(u2.argumentId) ?? assumpByArg.set(u2.argumentId, []).get(u2.argumentId)!).push(clamp01(u2.weight ?? 0.6));

  const baseByArg = new Map<string, number>(supports.map(s => [s.argumentId, s.base ?? 0.55]));

  type Contribution = { argumentId: string; score: number; parts: { base: number; premises: number[]; assumptions: number[] } };
  const contributionsByClaim = new Map<string, Contribution[]>();
  const argsByClaim = new Map<string, string[]>();

  for (const s of supports) {
    const base = baseByArg.get(s.argumentId) ?? 0.55;
    const premIds = byTo.get(s.argumentId) ?? [];
    const premBases = premIds.map(pid => baseByArg.get(pid) ?? 0.5);
    const premFactor = premBases.length ? compose(premBases, mode) : 1;
    const aBases = assumpByArg.get(s.argumentId) ?? [];
    const assumpFactor = aBases.length ? compose(aBases, mode) : 1;
    const score = clamp01(compose([base, premFactor], mode) * assumpFactor);

    (contributionsByClaim.get(s.claimId) ?? contributionsByClaim.set(s.claimId, []).get(s.claimId)!)
      .push({ argumentId: s.argumentId, score, parts: { base, premises: premBases, assumptions: aBases } });

    (argsByClaim.get(s.claimId) ?? argsByClaim.set(s.claimId, []).get(s.claimId)!).push(s.argumentId);
  }

  const support: Record<string, number> = {};
  const nodes = claims.map(c => {
    const contribs = (contributionsByClaim.get(c.id) ?? []).sort((a, b) => b.score - a.score);
    const s = join(contribs.map(x => x.score), mode);
    support[c.id] = +s.toFixed(4);
    const top = contribs.slice(0, 5).map(x => ({ argumentId: x.argumentId, score: +x.score.toFixed(4) }));
    return { id: c.id, diagramId: conclByClaim.get(c.id) ?? null, type: 'claim' as const, text: c.text, score: support[c.id], top };
  });

  const argIds = Array.from(new Set(supports.map(s => s.argumentId)));
  const argumentsMeta = await prisma.argument.findMany({
    where: { id: { in: argIds } },
    select: { id: true, text: true, quantifier: true, modality: true },
  });

  const hom: Record<string, { args: string[] }> = {};
  for (const [claimId, argList] of argsByClaim) hom[`I|${claimId}`] = { args: Array.from(new Set(argList)) };

  return NextResponse.json({
    ok: true, deliberationId, mode, support, hom, nodes, arguments: argumentsMeta,
    meta: { claims: claims.length, supports: supports.length, edges: edges.length, conclusions: conclusions.length }
  }, { headers: { 'Cache-Control': 'no-store' } });
}
