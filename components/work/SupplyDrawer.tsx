// components/work/SupplyDrawer.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

type Edge = {
  id: string;
  kind: string;
  fromWorkId?: string | null;
  toWorkId?: string | null;
  fromClaimId?: string | null;
  toClaimId?: string | null;
  meta?: any;
  createdAt?: string;
};

type WorkLite = { id: string; title: string; theoryType: 'DN'|'IH'|'TC'|'OP' };
type ClaimLite = { id: string; text: string };

export default function SupplyDrawer({
  workId,
  open,
  onClose,
}: { workId: string; open: boolean; onClose: () => void }) {




  const [onlyDN, setOnlyDN] = React.useState(true);
  // In components/work/SupplyDrawer.tsx
const [candidates, setCandidates] = React.useState<{ id:string; title:string; theoryType:string }[]>([]);
const [selectedAlt, setSelectedAlt] = React.useState('');
const [selectedEval, setSelectedEval] = React.useState(''); // NEW
const [loadingCandidates, setLoadingCandidates] = React.useState(false);
const [workMeta, setWorkMeta] = React.useState<{ deliberationId?: string } | null>(null);



// Fetch deliberation for this work once
React.useEffect(() => {
  if (!open) return;
  (async () => {
    const r = await fetch(`/api/works/${workId}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
    setWorkMeta(r?.work ? { deliberationId: r.work.deliberationId } : null);
  })();
}, [open, workId]);





// load work meta → deliberationId
React.useEffect(() => {
  if (!open) return;
  (async () => {
    try {
      const r = await fetch(`/api/works/${workId}`, { cache:'no-store' });
      const j = await r.json();
      setWorkMeta(j?.work ? { deliberationId: j.work.deliberationId } : null);
    } catch {}
  })();
}, [open, workId]);

// fetch candidates using deliberationId
React.useEffect(() => {
  if (!open || !workMeta?.deliberationId) return;
  (async () => {
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(workMeta.deliberationId ?? '')}`, { cache:'no-store' });
      const j = await res.json();
      const ihTc = (j.works ?? []).filter((w:any) => w.theoryType==='IH' || w.theoryType==='TC');
      setCandidates(ihTc);
    } catch {}
    setLoadingCandidates(false);
  })();
}, [open, workMeta?.deliberationId]);

  // --- Data sources (lazy when closed) ---
  const suppliesKey = open ? `/api/works/${workId}/supplies` : null;
  const altsKey     = open ? `/api/knowledge-edges?toWorkId=${workId}&kinds=ALTERNATIVE_TO` : null;
  const evalsKey    = open ? `/api/knowledge-edges?toWorkId=${workId}&kinds=EVALUATES` : null;




// // fetch deliberation for this work once the drawer opens
// React.useEffect(() => {
//   if (!open) return;
//   (async () => {
//     const r = await fetch(`/api/works/${workId}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
//     setWorkMeta(r?.work ? { deliberationId: r.work.deliberationId } : null);
//   })();
// }, [open, workId]);




// React.useEffect(() => {
//   if (!open || !workMeta?.deliberationId) return;
//   (async () => {
//     setLoadingCandidates(true);
//     try {
//       const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(workMeta.deliberationId ?? '')}`, { cache:'no-store' });
//       const j = await res.json();
//       const ihTc = (j.works ?? []).filter((w:any) => w.theoryType==='IH' || w.theoryType==='TC');
//       setCandidates(ihTc);
//     } catch {}
//     setLoadingCandidates(false);
//   })();
// }, [open, workMeta?.deliberationId]);

  const {
    data: supRes,
    isLoading: loadingSup,
    mutate: refetchSup,
  } = useSWR<{ ok: boolean; edges: Edge[]; works: WorkLite[]; claims: ClaimLite[] }>(suppliesKey, fetcher);

  const {
    data: altsRes,
    isLoading: loadingAlts,
    mutate: refetchAlts,
  } = useSWR<{ ok: boolean; edges: Edge[]; works: WorkLite[] }>(altsKey, fetcher);

  const {
    data: evalsRes,
    isLoading: loadingEvals,
    mutate: refetchEvals,
  } = useSWR<{ ok: boolean; edges: Edge[]; works: WorkLite[] }>(evalsKey, fetcher);

  // --- Auto-refresh on "mesh:edges-updated" ---
  React.useEffect(() => {
    if (!open) return;
    const h = (e: any) => {
      if (!e?.detail?.toWorkId || e.detail.toWorkId !== workId) return;
      refetchSup();
      refetchAlts();
      refetchEvals();
    };
    window.addEventListener('mesh:edges-updated' as any, h);
    return () => window.removeEventListener('mesh:edges-updated' as any, h);
  }, [open, workId, refetchSup, refetchAlts, refetchEvals]);


  // --- Merge hydration across responses ---
  const workMap: Record<string, WorkLite> = React.useMemo(() => {
    const wm: Record<string, WorkLite> = {};
    for (const w of (supRes?.works ?? [])) wm[w.id] = w;
    for (const w of (altsRes?.works ?? [])) wm[w.id] = w;
    for (const w of (evalsRes?.works ?? [])) wm[w.id] = w;
    return wm;
  }, [supRes?.works, altsRes?.works, evalsRes?.works]);

  const claimMap: Record<string, ClaimLite> = React.useMemo(() => {
    const cm: Record<string, ClaimLite> = {};
    for (const c of (supRes?.claims ?? [])) cm[c.id] = c;
    return cm;
  }, [supRes?.claims]);


React.useEffect(() => {
  if (!open) return;
  (async () => {
    setLoadingCandidates(true);
    try {
      // fetch all works in this deliberation, then filter to IH/TC
      const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(workId)}`, { cache:'no-store' });
      const j = await res.json();
      const ihTc = (j.works ?? []).filter((w:any) => w.theoryType==='IH' || w.theoryType==='TC');
      setCandidates(ihTc);
    } catch {}
    setLoadingCandidates(false);
  })();
}, [open, workId]);

  // --- Tab datasets ---
  const supplyEdges = (supRes?.edges ?? []).filter(e =>
    !onlyDN || (e.fromWorkId && workMap[e.fromWorkId]?.theoryType === 'DN')
  );
  const altEdges    = (altsRes?.edges ?? []);
  const evalEdges   = (evalsRes?.edges ?? []);

  const emptySup = !loadingSup  && supplyEdges.length === 0;
  const emptyAlt = !loadingAlts && altEdges.length    === 0;
  const emptyEva = !loadingEvals && evalEdges.length  === 0;

    if (!open) return null;


  return (
    <div className="fixed inset-0 bg-black/20 z-50" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-[460px] bg-white border-l p-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Dependencies</div>
          <button className="text-xs underline" onClick={onClose}>Close</button>
        </div>

        <Tabs defaultValue="supplies" className="mt-3">
          <TabsList>
            <TabsTrigger value="supplies">Supplies</TabsTrigger>
            <TabsTrigger value="alternatives">Alternatives</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          </TabsList>

          {/* SUPPLIES */}
          <TabsContent value="supplies">
            <div className="mt-2 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyDN}
                  onChange={e => setOnlyDN(e.target.checked)}
                />
                Only DN works
              </label>
            </div>

            <div className="mt-3 space-y-2">
              {loadingSup && <div className="text-xs text-neutral-500">Loading…</div>}
              {!loadingSup && emptySup && <div className="text-xs text-neutral-500">No supplies yet.</div>}

              {supplyEdges.map((e) => (
                <div key={e.id} className="rounded border p-2 text-sm">
                  <div className="text-[11px] text-neutral-500">{e.kind}</div>
                  {e.fromWorkId && (
                    <div>
                      From Work: <b>{workMap[e.fromWorkId]?.title ?? e.fromWorkId}</b>{' '}
                      <span className="text-[11px] text-neutral-500">
                        [{workMap[e.fromWorkId]?.theoryType ?? '—'}]
                      </span>
                    </div>
                  )}
                  {e.fromClaimId && (
                    <div>From Claim: “{claimMap[e.fromClaimId]?.text?.slice(0,120) ?? e.fromClaimId}”</div>
                  )}
                  {e.toClaimId && (
                    <div className="text-[12px] text-neutral-600">
                      Targets Claim: “{claimMap[e.toClaimId]?.text?.slice(0,120) ?? e.toClaimId}”
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ALTERNATIVES */}
          <TabsContent value="alternatives">
  <div className="mt-2 space-y-2">
    {loadingAlts && <div className="text-xs text-neutral-500">Loading…</div>}
    {!loadingAlts && emptyAlt && <div className="text-xs text-neutral-500">No alternatives yet.</div>}

    {altEdges.map((e) => (
      <div key={e.id} className="border rounded p-2 text-sm">
        <div className="text-[11px] text-neutral-500">ALTERNATIVE_TO</div>
        <div>
          From Work:{' '}
          <b>{workMap[e.fromWorkId ?? '']?.title ?? e.fromWorkId}</b>{' '}
          <span className="text-[11px] text-neutral-500">
            [{workMap[e.fromWorkId ?? '']?.theoryType ?? '—'}]
          </span>
        </div>
      </div>
    ))}

    {/* Add alternative form */}
    <div className="mt-3 rounded border p-2 text-sm bg-neutral-50">
      <div className="font-medium text-xs mb-1">Add alternative</div>
      {loadingCandidates ? (
        <div className="text-xs text-neutral-500">Loading IH/TC works…</div>
      ) : (
        <>
          <select
            className="border rounded px-2 py-1 text-xs w-full mb-2"
            value={selectedAlt}
            onChange={e=>setSelectedAlt(e.target.value)}
          >
            <option value="">— Select IH/TC Work —</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>
                {c.title} [{c.theoryType}]
              </option>
            ))}
          </select>
          <button
            className="px-2 py-1 border rounded text-xs bg-white"
            disabled={!selectedAlt}
            onClick={async () => {
              try {
                const res = await fetch('/api/knowledge-edges', {
                  method:'POST',
                  headers:{ 'content-type':'application/json' },
                  body: JSON.stringify({
                    deliberationId: workMeta?.deliberationId ?? '',  // was workId; fix here

                    kind: 'ALTERNATIVE_TO',
                    fromWorkId: selectedAlt,
                    toWorkId: workId,
                  }),
                });
                if (!res.ok) {
                  const txt = await res.text();
                  alert(`Failed: ${res.status} ${txt}`);
                  return;
                }
                setSelectedAlt('');
                // trigger refresh
                window.dispatchEvent(new CustomEvent('mesh:edges-updated', { detail: { toWorkId: workId } }));
              } catch (err:any) {
                alert(err.message || 'Error saving alternative');
              }
            }}
          >
            Add Alternative
          </button>
        </>
      )}
    </div>
  </div>
</TabsContent>

          {/* EVALUATIONS */}
          <TabsContent value="evaluations">
  <div className="mt-2 space-y-2">
    {loadingEvals && <div className="text-xs text-neutral-500">Loading…</div>}
    {!loadingEvals && emptyEva && <div className="text-xs text-neutral-500">No evaluations yet.</div>}

    {evalEdges.map((e) => {
      const mcda = e.meta?.mcda;
      return (
        <div key={e.id} className="border rounded p-2 text-sm">
          <div className="text-[11px] text-neutral-500">EVALUATES</div>
          <div>
            From Work:{' '}
            <b>{workMap[e.fromWorkId ?? '']?.title ?? e.fromWorkId}</b>{' '}
            <span className="text-[11px] text-neutral-500">
              [{workMap[e.fromWorkId ?? '']?.theoryType ?? '—'}]
            </span>
          </div>
          {e.meta?.verdict && <div className="text-[11px] mt-1">Verdict: {e.meta.verdict}</div>}
          {mcda && (
            <div className="text-[11px] text-neutral-600 mt-1">
              Best option: <b>{mcda.bestOptionId ?? '—'}</b> · k={Object.keys(mcda.totals || {}).length}
            </div>
          )}
          {e.meta?.adequacy?.items && (
            <div className="text-[11px] text-neutral-600 mt-1">
              Adequacy: {e.meta.adequacy.items.map((it: any) => `${it.criterion}:${it.result}`).join(', ')}
            </div>
          )}
        </div>
      );
    })}

    {/* Add evaluation form */}
<div className="mt-3 rounded border p-2 text-sm bg-neutral-50">
  <div className="font-medium text-xs mb-1">Add evaluation</div>
  {loadingCandidates ? (
    <div className="text-xs text-neutral-500">Loading IH/TC works…</div>
  ) : (
    <>
      <select value={selectedEval} onChange={e=>setSelectedEval(e.target.value)} /* ... */>
  <option value="">— Select IH/TC Work —</option>
  {candidates.map(c => <option key={c.id} value={c.id}>{c.title} [{c.theoryType}]</option>)}
</select>
<button
  disabled={!selectedEval}
  onClick={() => {
    window.dispatchEvent(new CustomEvent('mesh:open-evaluation-sheet', {
      detail: { fromWorkId: selectedEval, toWorkId: workId }
    }));
    setSelectedEval('');
  }}
>
  Open EvaluationSheet
</button>
    </>
  )}
</div>
  </div>
</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
