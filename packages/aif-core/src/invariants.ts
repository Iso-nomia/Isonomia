// packages/aif-core/src/invariants.ts
import type { AifGraph } from './types';
import { assertCreateArgumentLegality, assertAttackLegality } from './guards';

/** Minimal, fast structural checks to keep graphs AIF-legal. */
export function validateAifGraph(g: AifGraph) {
  const errors: string[] = [];

  const claimIds = new Set(g.claims.map(c => c.id));
  const argById = new Map(g.arguments.map(a => [a.id, a]));

  // RA legality & presence of claims
  for (const a of g.arguments) {
    try {
      assertCreateArgumentLegality({
        deliberationId: 'graph', authorId: 'graph',
        conclusionClaimId: a.conclusionClaimId,
        premiseClaimIds: a.premiseClaimIds,
        schemeId: a.schemeKey ?? null,
        implicitWarrant: a.implicitWarrant,
      });
    } catch (e: any) {
      errors.push(`Argument ${a.id} illegal: ${e.message}`);
    }
    if (!claimIds.has(a.conclusionClaimId)) {
      errors.push(`Argument ${a.id} conclusionClaimId missing/unknown`);
    }
    for (const pid of a.premiseClaimIds) {
      if (!claimIds.has(pid)) errors.push(`Argument ${a.id} premise missing/unknown ${pid}`);
      if (pid === a.conclusionClaimId) errors.push(`Argument ${a.id} uses conclusion as a premise`);
    }
  }

  // CA legality & premise targeting
  for (const at of g.attacks) {
    try {
      assertAttackLegality({
        deliberationId: 'graph', createdById: 'graph',
        fromArgumentId: at.fromArgumentId,
        attackType: at.attackType, targetScope: at.targetScope,
        toArgumentId: at.toArgumentId ?? undefined,
        targetClaimId: at.targetClaimId ?? undefined,
        targetPremiseId: at.targetPremiseId ?? undefined,
        cqKey: at.cqKey ?? null
      });
    } catch (e: any) {
      errors.push(`Attack ${at.id} illegal: ${e.message}`);
    }
    if (at.targetScope === 'premise' && at.toArgumentId) {
      const target = argById.get(at.toArgumentId);
      const prem = at.targetPremiseId;
      if (!target) errors.push(`Attack ${at.id} targets missing RA ${at.toArgumentId}`);
      if (target && prem && !target.premiseClaimIds.includes(prem)) {
        errors.push(`Attack ${at.id} undermines non-premise ${prem} on RA ${at.toArgumentId}`);
      }
    }
  }

  // PA legality (Def 2.1(5))
  for (const p of g.preferences ?? []) {
    const okPref = !!p.preferred?.id && !!p.dispreferred?.id;
    if (!okPref) errors.push(`PA ${p.id} requires one preferred and one dispreferred element`);
    if (p.preferred.kind === p.dispreferred.kind && p.preferred.id === p.dispreferred.id) {
      errors.push(`PA ${p.id} has identical preferred and dispreferred`);
    }
  }

  return { ok: errors.length === 0, errors };
}
export function assertRA(premiseCount: number, conclusionPresent: boolean) {
  if (!(premiseCount >= 1 && conclusionPresent)) throw new Error('RA must have ≥1 premise and exactly 1 conclusion');
}
export function assertCA(left: number, right: number) {
  if (!(left === 1 && right === 1)) throw new Error('CA must have 1 conflicting and 1 conflicted element');
}
export function assertPA(pref: number, disp: number) {
  if (!(pref === 1 && disp === 1)) throw new Error('PA must have 1 preferred and 1 dispreferred element');
}
