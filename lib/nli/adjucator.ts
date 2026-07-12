// lib/nli/adjudicator.ts
export type NLIRelation = 'entails'|'contradicts'|'neutral';
export type NLIReqPair = { premise: string; hypothesis: string; from?: {type:'argument'|'claim', id:string}, to?: {type:'argument'|'claim', id:string} };
export type NLIRes = { relation: NLIRelation; score: number };

const NEG = /\b(no|not|never|cannot|can't|doesn't|isn't|aren't|won't|n't)\b/i;

function heuristic(premise: string, hypothesis: string): NLIRes {
  const p = (premise||'').toLowerCase();
  const h = (hypothesis||'').toLowerCase();

  // toy signals; replace with a real model when ready
  if (p.includes(h) && !NEG.test(h)) return { relation: 'entails', score: 0.70 };
  if (NEG.test(h) && !NEG.test(p) && p.split(' ').filter(w => h.includes(w)).length > Math.max(3, h.split(' ').length/3)) {
    return { relation: 'contradicts', score: 0.70 };
  }
  return { relation: 'neutral', score: 0.50 };
}

export async function adjudicateBatch(pairs: NLIReqPair[]): Promise<NLIRes[]> {
  // Hook for a real provider:
  // if (process.env.NLI_HTTP_ENDPOINT) { /* call it and return */ }
  return pairs.map(({premise, hypothesis}) => heuristic(premise, hypothesis));
}
