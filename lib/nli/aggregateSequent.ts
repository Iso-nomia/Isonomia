// lib/nli/aggregateSequent.ts
export type NLIResult = { relation: 'entails'|'contradicts'|'neutral'; score: number };
export type PairReq = { premise: string; hypothesis: string };

export type SequentEval = {
  perDelta: { delta: string; entail: number; contradict: number }[];
  sequentEntail: number;
  sequentContradict: number;
  label: 'strong'|'weak'|'incoherent';
};

const ENTAIL_T = 0.75;
const WEAK_T = 0.45;
const CONTRA_T = 0.30;

export function aggregateSequent(gamma: string[], delta: string[], pairwise: NLIResult[][]): SequentEval {
  // pairwise[j] corresponds to δ_j and is an array of NLI over γ_i -> δ_j
  const perDelta = delta.map((d, j) => {
    const r = pairwise[j] || [];
    const entail = r.reduce((m, x) => x.relation === 'entails' ? Math.max(m, x.score) : m, 0);
    const contradict = r.reduce((m, x) => x.relation === 'contradicts' ? Math.max(m, x.score) : m, 0);
    return { delta: d, entail, contradict };
  });

  const sequentEntail = perDelta.reduce((m, x) => Math.min(m, x.entail), 1);
  const sequentContradict = perDelta.reduce((m, x) => Math.max(m, x.contradict), 0);

  let label: SequentEval['label'] = 'incoherent';
  if (sequentContradict < CONTRA_T && sequentEntail >= ENTAIL_T) label = 'strong';
  else if (sequentContradict < CONTRA_T && sequentEntail >= WEAK_T) label = 'weak';

  return { perDelta, sequentEntail, sequentContradict, label };
}
