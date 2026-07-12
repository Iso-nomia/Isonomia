'use client';
import useSWR from 'swr';
import { aggregateSequent, type NLIResult } from '@/lib/nli/aggregateSequent';

const fetcher = (u: string, init?: RequestInit) =>
  fetch(u, init).then(r => r.json());

type UseSequentArgs = {
  gammaTexts: string[];
  deltaTexts: string[];
};

export function useSequentStatus({ gammaTexts, deltaTexts }: UseSequentArgs) {
  // make the NLI request body once
  const body = {
    pairs: deltaTexts.flatMap((d) => gammaTexts.map((g) => ({ premise: g, hypothesis: d }))),
  };
  const key = gammaTexts.length && deltaTexts.length ? ['/api/nli/batch', JSON.stringify(body)] : null;

  const { data, error, isValidating } = useSWR(key, ([url, b]) =>
    fetcher(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: b })
  );

  // Fallback if /api/nli/batch not yet implemented
  const nli = (data?.results as NLIResult[]) ?? gammaTexts.flatMap(() => deltaTexts.map(() => ({ relation: 'neutral', score: 0.0 } as NLIResult)));

  // reshape to per δ arrays
  const perDeltaArrays: NLIResult[][] = [];
  for (let j = 0; j < deltaTexts.length; j++) {
    const slice = nli.slice(j * gammaTexts.length, (j+1) * gammaTexts.length);
    perDeltaArrays.push(slice);
  }

  const sequent = aggregateSequent(gammaTexts, deltaTexts, perDeltaArrays);
  return { sequent, isValidating, error };
}
