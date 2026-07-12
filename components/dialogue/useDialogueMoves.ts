// components/dialogue/useDialogHooks.ts
'use client';

import useSWR from 'swr';
import { useEffect, useMemo } from 'react';

type MovesRes = { items: any[]; unresolvedByTarget: Record<string, any> };
const EMPTY_MOVES: MovesRes = { items: [], unresolvedByTarget: {} };

const fetchJSON = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

 const normId = (raw?: string | string[] | null) => {
     const v = Array.isArray(raw) ? raw[0] : raw;
     const s = typeof v === 'string' ? v.trim() : '';
     if (!s) return '';
     // 👇 harden against literal strings we don't want
     if (s === 'undefined' || s === 'null') return '';
     return s;
   };

   export function useDialogueMoves(deliberationId?: string | string[] | null) {
    const id = useMemo(() => normId(deliberationId), [deliberationId]);
  
    // Robust fetcher that works whether SWR passes a single 'key' or spread args
    const swrFetcher = useMemo(
      () =>
        async (...args: any[]) => {
          // Case 1: useSWR(keyArray, fetcher) -> fetcher receives [ keyArray ]
          if (args.length === 1) {
            const keyArg = args[0];
            if (Array.isArray(keyArg)) {
              const [, _id] = keyArg as [string, string];
              return fetchJSON<MovesRes>(`/api/deliberations/${encodeURIComponent(_id)}/moves`);
            }
            // Fallback if someone passes a string key by mistake
            const _id = String(keyArg ?? '');
            return fetchJSON<MovesRes>(`/api/deliberations/${encodeURIComponent(_id)}/moves`);
          }
  
          // Case 2: useSWR([a,b], fetcher) with spread -> fetcher receives ('moves', id)
          const _id = String(args[1] ?? '');
          return fetchJSON<MovesRes>(`/api/deliberations/${encodeURIComponent(_id)}/moves`);
        },
      []
    );
  
    const { data = EMPTY_MOVES, isLoading, error, mutate } = useSWR<MovesRes>(
      id ? ['moves', id] : null,     // ✅ key first
      swrFetcher,                    // ✅ robust fetcher second
      { revalidateOnFocus: false, fallbackData: EMPTY_MOVES }
    );
  
    const moves = useMemo(() => (Array.isArray(data.items) ? data.items : []), [data]);
    const unresolvedByTarget = useMemo(
      () => new Map<string, any>(Object.entries(data.unresolvedByTarget ?? {})),
      [data]
    );
  
    useEffect(() => {
      const onRefresh = () => mutate();
      window.addEventListener('dialogue:moves:refresh', onRefresh as any);
      return () => window.removeEventListener('dialogue:moves:refresh', onRefresh as any);
    }, [mutate]);
  
    return { id, moves, unresolvedByTarget, isLoading, error, mutate };
  }

/** Open CQs for a given target; hook pauses if ids are missing */
export function useOpenCqs(
  deliberationId?: string | string[] | null,
  targetId?: string | null
) {
     // Reuse the same normalization we use for deliberation ids
     const id  = useMemo(() => normId(deliberationId), [deliberationId]);
     const tid = useMemo(() => {
       const s = typeof targetId === 'string' ? targetId.trim() : '';
       if (!s || s === 'undefined' || s === 'null') return '';
       return s;
     }, [targetId]);
  

        const key = id && tid
          ? `/api/dialogue/open-cqs?deliberationId=${encodeURIComponent(id)}&targetId=${encodeURIComponent(tid)}`
          : null;

  const { data } = useSWR<{ ok: boolean; cqOpen: string[] }>(
    key,
    fetchJSON,
    { revalidateOnFocus: false, fallbackData: { ok: true, cqOpen: [] } }
  );

  return new Set<string>(Array.isArray(data?.cqOpen) ? data!.cqOpen : []);
}
