'use client';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

 export type CQBatchItem = {
     claimId: string;
     required: number;
     satisfied: number;
     completeness: number;
     openByScheme: Record<string, string[]>;
   };
   

export function useCQSummaryBatch(deliberationId: string, claimIds: string[]) {
  // stable, sorted param to avoid key churn
  const csv = [...new Set(claimIds)].sort().join(',');
  const key = claimIds.length
    ? `/api/deliberations/${deliberationId}/cq/summary?claimIds=${encodeURIComponent(csv)}`
    : null;

    const { data, error, isLoading, mutate } =
         useSWR<{ items: CQBatchItem[] }>(key, fetcher, {
           revalidateOnFocus: false,
           dedupingInterval: 1200
         });
    
         const byId = new Map<string, CQBatchItem>();
     if (Array.isArray(data?.items)) for (const it of data!.items) byId.set(it.claimId, it);
         
  return { byId, isLoading, error, mutate };
}
