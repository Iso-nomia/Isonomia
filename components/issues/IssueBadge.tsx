// components/issues/IssueBadge.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());


 export function IssueBadge({
   deliberationId,
  targetType = 'argument',
 targetId,
   onClick,
 }: {
   deliberationId: string;
   targetType?: 'argument'|'claim'|'card'|'inference';
   targetId: string;
   onClick?: () => void;
 }) {
  const qs = targetType === 'argument'
    ? `argumentIds=${encodeURIComponent(targetId)}`
   : `scope=${targetType}&ids=${encodeURIComponent(targetId)}`;
 const { data } = useSWR<{ ok:true; counts: Record<string, number> }>(
    `/api/deliberations/${encodeURIComponent(deliberationId)}/issues/counts?${qs}`,
     fetcher,
     { revalidateOnFocus: false }
   );
  const n = data?.counts?.[targetId] ?? 0;
   if (!n) return null;

   return (
     <button
       className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
       title={`${n} open issue${n>1?'s':''}`}
       onClick={onClick}
     >
       Issues {n}
     </button>
   );
 }
