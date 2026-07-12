// lib/cq/guardReason.ts
export function guardToUserMessage(payload: any): string {
    if (!payload?.code) return 'This CQ could not be marked addressed.';
    if (payload.code === 'CQ_PROOF_OBLIGATION_NOT_MET') {
      const { requiredAttack, hasEdge, nliRelation, nliScore, nliThreshold } = payload.guard || {};
      if (!hasEdge && requiredAttack === 'undercut') {
        return 'Attach an undercut (challenge the warrant/inference) to address this CQ.';
      }
      if (!hasEdge && requiredAttack === 'rebut') {
        return 'Attach a rebuttal to the claim’s conclusion or provide a strong contradiction (NLI).';
      }
      if (nliRelation === 'contradicts' && typeof nliScore === 'number') {
        return `Contradiction detected (${(nliScore*100).toFixed(0)}%), but below the acceptance threshold ${(nliThreshold*100).toFixed(0)}%.`;
      }
      return 'Attach a counter (rebut/undercut) to address this CQ.';
    }
    return 'Action blocked by CQ guard.';
  }
  