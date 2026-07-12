// components/issues/IssuesDrawer.tsx
'use client';
import * as React from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import IssueDetail from './IssueDetail';
import { useBusEffect } from '@/lib/client/useBusEffect';
const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function IssuesDrawer({
  deliberationId,
  open,
  onOpenChange,
  argumentId,           // 👈 NEW
  claimId,  
  cardId,
  inferenceId,

}: {
  deliberationId: string;
  open: boolean;
  onOpenChange: (o:boolean)=>void;
  argumentId?: string;  // 👈 NEW
  claimId?: string;     // 👈 NEW
  cardId?: string;
  inferenceId?: string;

}) {
  const [state, setState] = React.useState<'open'|'closed'|'all'>('open');
  const [q, setQ] = React.useState('');
  const [focus, setFocus] = React.useState<string|null>(null);
  //const [filters, setFilters] = React.useState<{ argumentId?: string }>({});
  const [filters, setFilters] = React.useState<{ argumentId?: string; claimId?: string; cardId?: string; inferenceId?: string }>({});

  React.useEffect(() => {

   if (!open) return;
    setFilters(prev => ({ ...prev, argumentId, claimId, cardId, inferenceId }));
  }, [open, argumentId, claimId, cardId, inferenceId]);

    const key = `/api/deliberations/${encodeURIComponent(deliberationId)}/issues`
     + `?state=${state}&search=${encodeURIComponent(q)}`
     + (filters.argumentId ? `&argumentId=${encodeURIComponent(filters.argumentId)}` : '')
     + (filters.claimId ? `&claimId=${encodeURIComponent(filters.claimId)}` : '')
     + (filters.cardId ? `&cardId=${encodeURIComponent(filters.cardId)}` : '')
     + (filters.inferenceId ? `&targetType=inference&targetId=${encodeURIComponent(filters.inferenceId)}` : '');
  const { data, isLoading } = useSWR<{ ok:true; issues:any[] }>(open ? key : null, fetcher, { revalidateOnFocus:false });

  // keep in sync via global event
  // React.useEffect(() => {
  //   const refresh = (e:any) => {
  //     if (e?.detail?.deliberationId !== deliberationId) return;
  //     globalMutate(key);
  //   };
  //   window.addEventListener('issues:refresh', refresh as any);
  //   return () => window.removeEventListener('issues:refresh', refresh as any);
  // }, [key, deliberationId]);

      useBusEffect(['issues:changed'], (p) => {
      if (p?.deliberationId !== deliberationId) return;
      globalMutate(key);
 });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl sm:max-w-[780px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issues</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-2">
          <select className="border rounded px-2 py-1 text-xs" value={state} onChange={e=>setState(e.target.value as any)}>
            <option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option>
          </select>
          <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>

            {(filters.argumentId || filters.claimId) && (
     <div className="text-[10px] text-neutral-600 mb-2">
       Filtered to {filters.claimId ? `claim ${filters.claimId.slice(0,6)}…` : `argument ${filters.argumentId?.slice(0,6)}…`}
       <button className="ml-2 underline" onClick={()=>setFilters({})}>clear</button>
     </div>
   )}

        {/* List */}
        <div className="space-y-2">
          {isLoading && <div className="text-xs text-neutral-500">Loading…</div>}
          {(data?.issues ?? []).map(it => (
            <div key={it.id} className="rounded border p-2 hover:bg-slate-50 cursor-pointer" onClick={()=>setFocus(it.id)}>
              <div className="text-sm font-medium flex items-center justify-between">
                <span>{it.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${it.state==='open'?'bg-amber-50 border-amber-200 text-amber-800':'bg-slate-50 border-slate-200 text-slate-700'}`}>{it.state}</span>
              </div>
              <div className="text-[11px] text-neutral-600 mt-1">
                {it.description?.slice(0, 160) || '—'}
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">links: {it._count?.links ?? it.links?.length ?? 0}</div>
            </div>
          ))}
          {!isLoading && (data?.issues ?? []).length === 0 && <div className="text-xs text-neutral-500">No issues.</div>}
        </div>

        {/* Detail modal */}
        {focus && (
          <IssueDetail
            deliberationId={deliberationId}
            issueId={focus}
            onClose={() => setFocus(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
