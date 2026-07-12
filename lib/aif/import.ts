// lib/aif/import.ts
import crypto from 'crypto';
import { prisma } from '@/lib/prismaclient';

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

// --- JSON-LD @graph helpers (canonical format, produced by lib/aif/jsonld.ts) ---
// Nodes carry an `@id`; RA `@type` is an ARRAY (e.g. ["aif:RA","as:<key>"]) while
// I/CA/PA `@type` are scalar strings. Edges are graph items WITHOUT an `@id`,
// carrying `aif:from`/`aif:to` and an `@type` naming the role.
const hasType = (n: any, t: string): boolean => {
  const ty = n?.['@type'];
  return Array.isArray(ty) ? ty.includes(t) : ty === t;
};
const textOf = (n: any): string => String(n?.['aif:text'] ?? n?.text ?? '').trim();
const roleEndsWith = (e: any, suffix: string): boolean => {
  const ty = e?.['@type'];
  return typeof ty === 'string' && ty.endsWith(suffix);
};

/**
 * Import canonical AIF JSON-LD (the `@graph` form emitted by lib/aif/jsonld.ts).
 *
 * Decision Q5 / issue K (PA_NODE_PREFERENCE_INTEGRATION_ROADMAP): the `@graph`
 * JSON-LD is the public/interop serialization, so this importer consumes it
 * directly (array `@type`, `aif:text`, role-typed edge nodes with `aif:from`/
 * `aif:to`). The legacy `{nodes,edges}` shape from lib/aif/export.ts is handled
 * by packages/aif-core/src/import.ts for its own callers.
 */
export async function importAifJSONLD(deliberationId: string, graph: any) {
  const items: any[] = Array.isArray(graph?.['@graph']) ? graph['@graph'] : null as any;
  if (!items) {
    throw new Error("importAifJSONLD expects JSON-LD with an '@graph' array (lib/aif/jsonld.ts form).");
  }

  const nodes = items.filter((x: any) => typeof x?.['@id'] === 'string');
  const edges = items.filter((x: any) => x?.['aif:from'] && x?.['aif:to']);
  const nodeById = new Map(nodes.map((n: any) => [n['@id'], n]));
  const isType = (id: string, t: string) => hasType(nodeById.get(id), t);

  const I_nodes = nodes.filter((n: any) => hasType(n, 'aif:InformationNode'));
  const RA_nodes = nodes.filter((n: any) => hasType(n, 'aif:RA'));
  const CA_nodes = nodes.filter((n: any) => hasType(n, 'aif:CA'));
  const PA_nodes = nodes.filter((n: any) => hasType(n, 'aif:PA'));

  const premEdges = edges.filter((e: any) => roleEndsWith(e, 'Premise'));
  const concEdges = edges.filter((e: any) => roleEndsWith(e, 'Conclusion'));

  // 1) Claims (I-nodes)
  const claimMap = new Map<string, string>();
  for (const n of I_nodes) {
    const c = await prisma.claim.create({
      data: {
        deliberationId,
        text: textOf(n),
        createdById: 'importer',
        moid: `imported-${crypto.randomBytes(8).toString("hex")}`,
      }
    });
    claimMap.set(n['@id'], c.id);
  }

  // 2) Arguments (RA-nodes)
  const raMap = new Map<string, string>();
  for (const s of RA_nodes) {
    const sid = s['@id'];
    const cI = concEdges.find((e: any) => e['aif:from'] === sid)?.['aif:to'];
    if (!cI || !claimMap.has(cI)) continue;
    const pIs = premEdges
      .filter((e: any) => e['aif:to'] === sid)
      .map((e: any) => e['aif:from'])
      .filter((iid: string) => claimMap.has(iid));

    const schemeKey: string | null =
      (s['aif:usesScheme'] ?? s['as:appliesSchemeKey'] ?? null) || null;
    const scheme = schemeKey
      ? await prisma.argumentScheme.findFirst({ where: { key: schemeKey }, select: { id: true } })
      : null;
    if (schemeKey && !scheme) {
      console.warn(`[AIF Import] Unknown scheme key "${schemeKey}" on RA node ${sid}, setting schemeId = null`);
    }

    const a = await prisma.argument.create({
      data: {
        deliberationId, authorId: 'importer', text: '',
        schemeId: scheme?.id ?? null,
        conclusionClaimId: claimMap.get(cI)!,
      }
    });
    if (pIs.length) {
      await prisma.argumentPremise.createMany({
        data: pIs.map((iid: string) => ({ argumentId: a.id, claimId: claimMap.get(iid)!, isImplicit: false })),
        skipDuplicates: true,
      });
    }
    raMap.set(sid, a.id);
  }

  // 3) Attacks (CA-nodes): conflicting → CA → conflicted
  for (const ca of CA_nodes) {
    const caId = ca['@id'];
    const conflictingId = edges.find((e: any) => e['aif:to'] === caId && roleEndsWith(e, 'ConflictingElement'))?.['aif:from'];
    const conflictedId = edges.find((e: any) => e['aif:from'] === caId && roleEndsWith(e, 'ConflictedElement'))?.['aif:to'];
    if (!conflictingId || !conflictedId) continue;

    // Resolve attacker argument id (RA-node → its argument; I-node → ensure an argument concluding it)
    const attackerArgId = isType(conflictingId, 'aif:RA')
      ? raMap.get(conflictingId)
      : claimMap.has(conflictingId)
        ? await ensureArgumentForClaim(deliberationId, claimMap.get(conflictingId)!)
        : undefined;
    if (!attackerArgId) continue;

    if (isType(conflictedId, 'aif:RA')) {
      // Attacks the inference → UNDERCUTS
      const target = raMap.get(conflictedId);
      if (!target) continue;
      await prisma.argumentEdge.create({
        data: {
          deliberationId, fromArgumentId: attackerArgId, toArgumentId: target,
          type: 'undercut', attackType: 'UNDERCUTS', targetScope: 'inference', createdById: 'importer',
        }
      });
    } else if (isType(conflictedId, 'aif:InformationNode') && claimMap.has(conflictedId)) {
      const cid = claimMap.get(conflictedId)!;
      // Premise of some RA → UNDERMINES; otherwise a conclusion → REBUTS
      const premOf = premEdges.find((e: any) => e['aif:from'] === conflictedId);
      if (premOf && raMap.get(premOf['aif:to'])) {
        await prisma.argumentEdge.create({
          data: {
            deliberationId, fromArgumentId: attackerArgId, toArgumentId: raMap.get(premOf['aif:to'])!,
            type: 'rebut', attackType: 'UNDERMINES', targetScope: 'premise', targetPremiseId: cid, createdById: 'importer',
          }
        });
      } else {
        // Target the argument that concludes this claim, if any
        const concOf = concEdges.find((e: any) => e['aif:to'] === conflictedId);
        const targetArgId = concOf ? raMap.get(concOf['aif:from']) : undefined;
        await prisma.argumentEdge.create({
          data: {
            deliberationId, fromArgumentId: attackerArgId,
            toArgumentId: targetArgId ?? attackerArgId,
            type: 'rebut', attackType: 'REBUTS', targetScope: 'conclusion', targetClaimId: cid, createdById: 'importer',
          }
        });
      }
    }
  }

  // 4) Preferences (PA-nodes): preferred → PA → dispreferred
  for (const pa of PA_nodes) {
    const paId = pa['@id'];
    const preferredId = edges.find((e: any) => e['aif:to'] === paId && roleEndsWith(e, 'PreferredElement'))?.['aif:from'];
    const dispreferredId = edges.find((e: any) => e['aif:from'] === paId && roleEndsWith(e, 'DispreferredElement'))?.['aif:to'];
    if (!preferredId || !dispreferredId) {
      console.warn(`[AIF Import] PA-node ${paId} missing preferred or dispreferred edges, skipping`);
      continue;
    }

    // PA `aif:usesScheme` is a PreferenceScheme *id* in our export; keep it only if it resolves.
    const schemeRef: string | null = (pa['aif:usesScheme'] ?? null) || null;
    const scheme = schemeRef
      ? await prisma.preferenceScheme.findUnique({ where: { id: schemeRef }, select: { id: true } }).catch(() => null)
      : null;

    const preferredIsRA = isType(preferredId, 'aif:RA');
    const dispreferredIsRA = isType(dispreferredId, 'aif:RA');

    await prisma.preferenceApplication.create({
      data: {
        deliberationId,
        createdById: 'importer',
        schemeId: scheme?.id ?? null,
        preferredArgumentId: preferredIsRA ? raMap.get(preferredId) ?? null : null,
        preferredClaimId: !preferredIsRA ? claimMap.get(preferredId) ?? null : null,
        dispreferredArgumentId: dispreferredIsRA ? raMap.get(dispreferredId) ?? null : null,
        dispreferredClaimId: !dispreferredIsRA ? claimMap.get(dispreferredId) ?? null : null,
      }
    });
  }

  return { ok: true };
}
