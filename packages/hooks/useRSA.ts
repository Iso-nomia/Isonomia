import useSWR from 'swr';
const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export function useRSA({ deliberationId, targetType, targetId }:{
  deliberationId: string; targetType: 'argument'|'claim'; targetId: string;
}) {
  const key = deliberationId && targetType && targetId
    ? `/api/deliberations/${encodeURIComponent(deliberationId)}/rsa?targetType=${targetType}&targetId=${targetId}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { revalidateOnFocus:false });
  return { rsa: data?.ok ? { R:data.R, S:data.S, A:data.A, notes:data.notes } : null, error, isLoading, mutate };
}
