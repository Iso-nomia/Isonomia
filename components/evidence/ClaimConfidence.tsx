// components/evidence/ClaimConfidence.tsx
"use client";
import useSWR from 'swr';
import { SupportBar } from './SupportBar';

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export function ClaimConfidence({
  deliberationId, claimId, mode='min', tau=0.7,
}: { deliberationId: string; claimId: string; mode?: 'min'|'prod'|'logodds'; tau?: number; }) {
  const qs = new URLSearchParams({ deliberationId, mode, tau: String(tau) }).toString();
  const { data } = useSWR<{ ok:boolean; items:Array<{id:string; score:number; bel?:number; pl?:number; accepted:boolean}> }>(
    `/api/evidential/score?${qs}`, fetcher, { revalidateOnFocus:false }
  );
  const row = data?.items?.find(i => i.id === claimId);
  const s = row?.score ?? row?.bel ?? 0;
  return <SupportBar value={s} label={row?.accepted ? 'Support (accepted)' : 'Support'} />;
}
