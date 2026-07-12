// lib/server/aif/validator.ts
import { prisma } from '@/lib/prismaclient';

export async function validateAifGraph(doc: any) {
  const errors: Array<{ path: string; message: string }> = [];
  const G = Array.isArray(doc?.['@graph']) ? doc['@graph'] : [];

  const claims = new Set<string>();
  const ras: any[] = [];

  for (const [i,n] of G.entries()) {
    const t = Array.isArray(n?.['@type']) ? n['@type'] : [n?.['@type']];
    if (t.includes('aif:InformationNode')) claims.add(n?.['@id']);
    if (t.includes('aif:RA')) ras.push({ idx:i, node:n });
  }

  if (ras.length === 0) errors.push({ path: '@graph', message: 'No RA nodes found' });

  // Premise & conclusion resources:
  const edges = G.filter((n:any) => n?.['@type']==='aif:Premise' || n?.['@type']==='aif:Conclusion');
  const byTo = new Map<string, any[]>();
  const byFrom = new Map<string, any[]>();
  for (const e of edges) {
    const from = e['aif:from'], to = e['aif:to'];
    if (from && to) {
      if (!byTo.has(to)) byTo.set(to, []);
      if (!byFrom.has(from)) byFrom.set(from, []);
      byTo.get(to)!.push(e); byFrom.get(from)!.push(e);
    }
  }

  // Scheme library (key → cq count)
  const schemes = await prisma.argumentScheme.findMany({
    select: { key:true, cqs: { select: { cqKey:true } } }
  });
  const cqCountByScheme = new Map(schemes.map(s => [s.key, (s.cqs||[]).length]));

  for (const ra of ras) {
    const id = ra.node['@id'];
    const usesScheme = ra.node['aif:usesScheme'] || null;
    const prems = (byTo.get(id) || []).filter(e => e['@type']==='aif:Premise');
    const concls = (byFrom.get(id) || []).filter(e => e['@type']==='aif:Conclusion');

    if (!prems.length) errors.push({ path:`@graph[${ra.idx}]`, message:'RA has no Premise edges' });
    if (!concls.length) errors.push({ path:`@graph[${ra.idx}]`, message:'RA has no Conclusion edge' });

    if (!usesScheme) {
      errors.push({ path:`@graph[${ra.idx}]`, message:'RA is missing aif:usesScheme (scheme key)' });
    } else if (!cqCountByScheme.has(String(usesScheme))) {
      errors.push({ path:`@graph[${ra.idx}]`, message:`Unknown scheme key: ${usesScheme}` });
    }
  }

  return { ok: errors.length === 0, errors };
}
