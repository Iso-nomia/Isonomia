// packages/aif-core/src/import.ts
import { prisma } from '@/lib/prismaclient';
import { resolveSchemeByFingerprint } from '@/lib/aif/behaviourFingerprint';
import { mintClaimMoid } from '@/lib/ids/mintMoid';

async function ensureArgumentForClaim(deliberationId: string, claimId: string) {
  const existing = await prisma.argument.findFirst({
    where: { deliberationId, conclusionClaimId: claimId }
  });
  if (existing) return existing.id;

  const a = await prisma.argument.create({
    data: {
      deliberationId, authorId: 'importer', text: '',
      conclusionClaimId: claimId, implicitWarrant: { imported: true }
    }
  });
  await prisma.argumentPremise.create({
    data: { argumentId: a.id, claimId, isImplicit: true }
  });
  return a.id;
}

/** Import minimal AIF JSON-LD produced by our exporter. */
export async function importAifJSONLD(deliberationId: string, graph: any) {
  const nodeById = new Map<string, any>(graph.nodes.map((n:any) => [n['@id'], n]));
  const typeOf = (id: string) => nodeById.get(id)?.['@type'];
  const I_nodes = graph.nodes.filter((n:any) => n['@type'] === 'aif:InformationNode');
  const RA_nodes = graph.nodes.filter((n:any) => n['@type'] === 'aif:RA');
  const CA_nodes = graph.nodes.filter((n:any) => n['@type'] === 'aif:CA');
  const edges = graph.edges ?? [];

  const prem = edges.filter((e:any) => e.role?.endsWith('Premise'));
  const conc = edges.filter((e:any) => e.role?.endsWith('Conclusion'));
  const attk = edges.filter((e:any) => e.role?.endsWith('Attacks'));

  // 1) Claims
  const claimMap = new Map<string,string>();
  for (const n of I_nodes) {
    const claimText = (n.text ?? '').trim();
    const c = await prisma.claim.create({
      data: { deliberationId, text: claimText, moid: mintClaimMoid(claimText), createdById: "importer" }
    });
    claimMap.set(n['@id'], c.id);
  }

  // 2) Arguments (RA)
  const raMap = new Map<string,string>();
  for (const s of RA_nodes) {
    const sid = s['@id'];
    const cI = conc.find((e:any) => e.from === sid)?.to;
    if (!cI) continue;
    const pIs = prem.filter((e:any) => e.to === sid).map((e:any) => e.from);

    // Phase 4c (folksonomy step 17): resolve schemeId in this priority:
    //   1. exact `aif:usesScheme` / `as:appliesSchemeKey` key match;
    //   2. fingerprint match against the catalogue's materialised digest.
    // No silent merge — every fingerprint match is logged so import-path
    // soak reviews can audit the decision (Spec 4 §3.5).
    const schemeKey: string | null =
      (s['aif:usesScheme'] ?? s['as:appliesSchemeKey'] ?? s.usesScheme ?? null) || null;
    const fingerprint: string | null =
      (s['mesh:behaviourFingerprint'] ?? s.behaviourFingerprint ?? null) || null;
    let resolvedSchemeId: string | null = null;
    if (schemeKey) {
      const byKey = await prisma.argumentScheme.findFirst({
        where: { key: schemeKey, kind: 'argument-scheme' },
        select: { id: true },
      });
      if (byKey) resolvedSchemeId = byKey.id;
    }
    if (!resolvedSchemeId && fingerprint) {
      const resolution = await resolveSchemeByFingerprint(fingerprint);
      if (resolution.kind === 'match') {
        resolvedSchemeId = resolution.schemeId;
        // eslint-disable-next-line no-console
        console.info('[aif-import] fingerprint match', {
          ra: sid,
          fingerprint,
          schemeId: resolution.schemeId,
          schemeKey: resolution.schemeKey,
        });
      } else {
        // eslint-disable-next-line no-console
        console.info('[aif-import] fingerprint no-match', {
          ra: sid,
          fingerprint,
        });
      }
    }

    const a = await prisma.argument.create({
      data: {
        deliberationId, authorId: 'importer', text: '',
        schemeId: resolvedSchemeId, conclusionClaimId: claimMap.get(cI)!,
      }
    });
    if (pIs.length) {
      await prisma.argumentPremise.createMany({
        data: pIs.map((Iid:string) => ({
          argumentId: a.id, claimId: claimMap.get(Iid)!, isImplicit: false
        })),
        skipDuplicates: true
      });
    }
    raMap.set(sid, a.id);
  }

  // 3) Attacks (CA)
  for (const ca of CA_nodes) {
    const caId = ca['@id'];
    const attackerI = edges.find((e:any)=> e.to === caId && e.role?.endsWith('Premise'))?.from;
    if (!attackerI) continue;
    const attackerArgId = await ensureArgumentForClaim(deliberationId, claimMap.get(attackerI)!);

    const tgt = attk.find((e:any)=> e.from === caId);
    if (!tgt) continue;
    const tType = typeOf(tgt.to);

    if (tType === 'aif:RA') {
      await prisma.argumentEdge.create({
        data: {
          deliberationId,
          fromArgumentId: attackerArgId,
          toArgumentId: raMap.get(tgt.to)!,
          type: 'undercut',
          attackType: 'UNDERCUTS', targetScope: 'inference',
          createdById: 'importer',
        }
      });
    } else if (tType === 'aif:InformationNode') {
      const cid = claimMap.get(tgt.to)!;
      const isPremOf = prem.find((e:any) => e.from === tgt.to);
      if (isPremOf) {
        await prisma.argumentEdge.create({
          data: {
            deliberationId,
            fromArgumentId: attackerArgId,
            toArgumentId: raMap.get(isPremOf.to)!,
            type: 'undercut',
            attackType: 'UNDERMINES', targetScope: 'premise',
            targetPremiseId: cid, createdById: 'importer',
          }
        });
      } else {
        await prisma.argumentEdge.create({
          data: {
            deliberationId,
            fromArgumentId: attackerArgId,
            toArgumentId: attackerArgId,
            type: 'rebut',
            attackType: 'REBUTS', targetScope: 'conclusion',
            targetClaimId: cid, createdById: 'importer',
          }
        });
      }
    }
  }

  // 4) Assumptions (Presumption/Exception edges)
  const presumptionEdges = edges.filter((e:any) => 
    e.role === 'as:HasPresumption' || e.role === 'as:HasException'
  );
  for (const pe of presumptionEdges) {
    const raId = pe.to; // Target RA node
    const assumptionId = pe.from; // Source I node
    const argumentId = raMap.get(raId);
    const claimId = claimMap.get(assumptionId);
    
    if (!argumentId || !claimId) continue;
    
    const role = pe.role === 'as:HasException' ? 'exception' : 'premise';
    
    await prisma.assumptionUse.create({
      data: {
        deliberationId,
        argumentId,
        assumptionClaimId: claimId,
        role,
        // status defaults to PROPOSED per schema
      }
    });
  }

  return { ok: true };
}
