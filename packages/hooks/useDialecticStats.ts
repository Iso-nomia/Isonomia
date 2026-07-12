import useSWR from 'swr';
const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export function useDialecticStats(deliberationId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    deliberationId ? `/api/deliberations/${encodeURIComponent(deliberationId)}/dialectic` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { stats: data?.stats ?? {}, now: data?.now ?? null, error, isLoading, mutate };
}
