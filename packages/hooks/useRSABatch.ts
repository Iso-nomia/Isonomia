import useSWR from 'swr';

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

/**
 * Batch RSA for a list of targets, e.g.
 * useRSABatch({ deliberationId, targets: ['argument:a1','claim:c9'] })
 * → { byTarget: { 'argument:a1': {R,S,A,...}, 'claim:c9': {...} } }
 */
export function useRSABatch({ deliberationId, targets }: {
  deliberationId: string;
  targets: string[]; // ["argument:<id>", "claim:<id>", ...]
}) {
  const clean = Array.from(new Set(targets.filter(Boolean)));
  const key = (deliberationId && clean.length)
    ? `/api/deliberations/${encodeURIComponent(deliberationId)}/rsa?targets=${encodeURIComponent(clean.join(','))}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });
  return {
    byTarget: data?.byTarget ?? {},
    error, isLoading, mutate
  };
}
