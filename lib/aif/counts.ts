//lib/aif/counts.ts

export type AifRowLite = {
  id: string;
  conclusionClaimId: string | null;
  premises: { claimId: string }[];
};

export type CACompact = {
  conflictedArgumentId: string | null;
  conflictedClaimId: string | null;
  legacyAttackType: ('REBUTS' | 'UNDERCUTS' | 'UNDERMINES') | null;
};

export function computeAttackCountsForArguments(
  args: AifRowLite[],
  caRows: CACompact[],
): Record<string, { REBUTS: number; UNDERCUTS: number; UNDERMINES: number }> {
  const result: Record<string, { REBUTS: number; UNDERCUTS: number; UNDERMINES: number }> = {};
  const byConclusion = new Map<string, string>(); // claimId -> argId
  const byPremise = new Map<string, string[]>();  // claimId -> [argId...]

  for (const a of args) {
    result[a.id] = { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
    if (a.conclusionClaimId) byConclusion.set(a.conclusionClaimId, a.id);
    for (const p of a.premises) {
      const list = byPremise.get(p.claimId) ?? [];
      list.push(a.id);
      byPremise.set(p.claimId, list);
    }
  }

  for (const ca of caRows) {
    const t = ca.legacyAttackType;
    if (!t) continue;
    if (t === 'UNDERCUTS' && ca.conflictedArgumentId) {
      const id = ca.conflictedArgumentId;
      if (result[id]) result[id].UNDERCUTS += 1;
      continue;
    }
    if ((t === 'REBUTS' || t === 'UNDERMINES') && ca.conflictedClaimId) {
      const cid = ca.conflictedClaimId;
      if (t === 'REBUTS') {
        const argId = byConclusion.get(cid);
        if (argId && result[argId]) result[argId].REBUTS += 1;
      } else {
        const argIds = byPremise.get(cid) ?? [];
        for (const id of argIds) if (result[id]) result[id].UNDERMINES += 1;
      }
    }
  }
  return result;
}