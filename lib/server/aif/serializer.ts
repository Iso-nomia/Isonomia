// lib/server/aif/serializer.ts
import { prisma } from '@/lib/prismaclient';

export async function upsertAifGraph(doc: any) {
  const G = Array.isArray(doc?.['@graph']) ? doc['@graph'] : [];
  const toId = (x:any) => String(x || '').replace(/^I:|^S:|^CA:/,'');
  const upserted: any[] = [];
  const rejected: any[] = [];

  // First pass: I-nodes → Claim cache
  const textByI = new Map<string, string>();
  for (const n of G) {
    if (n['@type'] === 'aif:InformationNode') textByI.set(n['@id'], String(n['aif:text'] ?? ''));
  }

  // RAs
  for (const n of G.filter((x:any) => (Array.isArray(x['@type']) ? x['@type'].includes('aif:RA'): x['@type']==='aif:RA'))) {
    const selfId = n['@id'];
    const schemeKey = n['aif:usesScheme'] || null;
    const premises = G.filter((e:any) => e['@type']==='aif:Premise' && e['aif:to']===selfId).map((e:any)=> e['aif:from']);
    const concls   = G.filter((e:any) => e['@type']==='aif:Conclusion' && e['aif:from']===selfId).map((e:any)=> e['aif:to']);
    if (!premises.length || !concls.length) { rejected.push({ id:selfId, error:'no_premise_or_conclusion' }); continue; }

    // Resolve/create Claims
    const concText = textByI.get(concls[0]) ?? '';
    const conc = await prisma.claim.create({ data: { text: concText || '(conclusion)', createdById:'system', moid: cryptoRandom(), deliberationId: null } });

    const premIds: string[] = [];
    for (const iId of premises) {
      const ptxt = textByI.get(iId) ?? '';
      const prem = await prisma.claim.create({ data: { text: ptxt || '(premise)', createdById:'system', moid: cryptoRandom(), deliberationId: null } });
      premIds.push(prem.id);
    }

    // Find scheme by key (optional)
    const scheme = schemeKey ? await prisma.argumentScheme.findUnique({ where: { key: String(schemeKey) }, select: { id:true } }) : null;

    const a = await prisma.argument.create({
      data: {
        deliberationId: 'aif-import', authorId: 'system',
        text: n['aif:name'] || '',
        schemeId: scheme?.id ?? null,
        conclusionClaimId: conc.id,
      }
    });
    await prisma.argumentPremise.createMany({ data: premIds.map(cid => ({ argumentId: a.id, claimId: cid, isImplicit:false })) });
    upserted.push({ ra: a.id });
  }

  return { upserted, rejected };
}
function cryptoRandom() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
