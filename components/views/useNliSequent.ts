'use client';
import useSWR from 'swr';

type NliRel = 'entails'|'contradicts'|'neutral';
type Pair = { premise: string; hypothesis: string };
type BatchResp = { ok: true; items: { relation: NliRel; score: number }[] };

function postFetcher(key: string, body: any) {
  return fetch('/api/nli/batch', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<BatchResp>;
  });
}

export type SequentVerdict = 'strong'|'weak'|'incoherent';
export type SequentSummary = {
  verdict: SequentVerdict;
  score: number;                               // [0..1] confidence for badge color/tooltip
  perDelta: { delta: string; entailMax: number; contraMax: number }[];
};

function aggregateSequent(gamma: string[], delta: string[], rels: { relation:NliRel; score:number }[]): SequentSummary {
  // rels are in cartesian order: for each δ, for each γ (γ fastest) OR however you choose—be explicit.
  // We'll build index [iDelta][iGamma].
  const perDelta: { delta: string; entailMax: number; contraMax: number }[] = [];
  let ptr = 0;
  for (let i = 0; i < delta.length; i++) {
    let entailMax = 0;
    let contraMax = 0;
    for (let j = 0; j < gamma.length; j++, ptr++) {
      const r = rels[ptr];
      if (!r) continue;
      if (r.relation === 'entails') entailMax = Math.max(entailMax, r.score);
      if (r.relation === 'contradicts') contraMax = Math.max(contraMax, r.score);
    }
    perDelta.push({ delta: delta[i], entailMax, contraMax });
  }

  // policy: incoherent if any contraMax ≥ 0.6; strong if min(entailMax) ≥ 0.75 and all contraMax < 0.6; weak otherwise.
  const minEntail = perDelta.length ? Math.min(...perDelta.map(d => d.entailMax)) : 0;
  const anyContra = perDelta.some(d => d.contraMax >= 0.6);
  let verdict: SequentVerdict = 'weak';
  if (anyContra) verdict = 'incoherent';
  else if (minEntail >= 0.75) verdict = 'strong';
  const score = Math.max(0, Math.min(1, verdict === 'incoherent' ? 1 - minEntail : minEntail));
  return { verdict, score, perDelta };
}

export function useNliSequent(gammaTexts: string[], deltaTexts: string[]) {
  const key = gammaTexts.length || deltaTexts.length
    ? `nli:sequent:${JSON.stringify([gammaTexts, deltaTexts]).slice(0, 4000)}`
    : null;

  const { data, error, isLoading } = useSWR(
    key,
    () => {
      // Cartesian product Γ×Δ in δ-major order for a compact, predictable layout.
      const pairs: Pair[] = [];
      for (const d of deltaTexts) for (const g of gammaTexts) pairs.push({ premise: g, hypothesis: d });
      return postFetcher('/api/nli/batch', { pairs });
    },
    { revalidateOnFocus: false }
  );

  let summary: SequentSummary | null = null;
  if (data?.items) {
    summary = aggregateSequent(gammaTexts, deltaTexts, data.items);
  }
  return { summary, isLoading, error };
}
