'use client';
import { useState, useEffect, useMemo } from "react";

import { WhyThis } from "../feed/WhyThis";
import ClaimMiniMap from "@/components/claims/ClaimMiniMap";
import CQBar from './CQBar';
import { useCQSummaryBatch } from '@/components/cq/useCQSummaryBatch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import CriticalQuestions from '@/components/claims/CriticalQuestionsV2';
import StyleDensityBadge from '@/components/rhetoric/StyleDensityBadge';
import PracticalLedger from '@/components/practical/PracticalLedger';
import SequentBadge from "../views/SequentBadge";
import { SequentDetails } from "../views/SequentDetails";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, MoreVertical } from 'lucide-react';
import useSWR, { mutate as globalMutate } from 'swr';


function useServerEvents(deliberationId: string | undefined) {
  useEffect(() => {
    if (!deliberationId) return;
    const es = new EventSource(`/api/bus/subscribe`);
    const reval = () => {
      // touch the keys RV depends on:
      globalMutate((k:string)=>k?.includes(`/api/claims/summary?deliberationId=${deliberationId}`));
      globalMutate((k:string)=>k?.includes(`/api/claims/labels?deliberationId=${deliberationId}`));
      globalMutate((k:string)=>k?.includes(`/api/deliberations/${deliberationId}/cq/summary`));
      globalMutate((k:string)=>k?.includes(`/api/arguments/batch`));
    };
    es.addEventListener('message', (ev:any) => {
      try {
        const { type, deliberationId: d0 } = JSON.parse(ev.data);
        if (!d0 || d0 === deliberationId) reval();
      } catch {}
    });
    return () => es.close();
  }, [deliberationId]);
}


import React from "react";
import Chip from "../ui/Chip";


type Arg = { id: string; text: string; confidence?: number | null };
// (1) Widen the View type locally — no server change required.
type View = {
  index: number;
  id?: string;
  arguments: Arg[];
  // OPTIONAL manual overrides. If provided, these take precedence.
  gammaClaimIds?: string[];
  deltaClaimIds?: string[];
};
type Rule = "utilitarian" | "harmonic" | "maxcov";

type CohortSummary = {
  totals: Record<string, number>;
  byArgument: Record<string, Record<string, string[]>>;
};

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());


// --- Extracted, hook-safe child ---
type CqSummary = {
  satisfied: number;
  required: number;
  openByScheme: Record<string, string[]>;
};

async function copySequentToClipboard(seq:{gammaTexts:string[];deltaTexts:string[]}) {
  const t = `Γ (premises)\n${seq.gammaTexts.join('\n')}\n\nΔ (conclusions)\n${seq.deltaTexts.join('\n')}`;
  await navigator.clipboard.writeText(t);
}

async function sendGammaToDialogue(deliberationId:string, texts:string[]) {
  // Single batched move with acts (alternatively one move per premise)
  const acts = texts.map((expression, i) => ({
    polarity: 'pos', locusPath: `0.${i+1}`, openings: [], expression
  }));
  await fetch('/api/dialogue/move', {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({
      deliberationId, targetType:'argument', targetId:'(sequent)', // not used downstream
      kind:'ASSERT', payload:{ acts }, autoCompile:true, autoStep:true, phase:'neutral'
    })
  });
  window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
}

async function exportAsCard(deliberationId:string, delta:string|undefined, gamma:string[]) {
  if (!delta) return;
  await fetch(`/api/deliberations/${deliberationId}/cards`, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({
      status:'published', claimText: delta, reasonsText: gamma, evidenceLinks: [], anticipatedObjectionsText:[]
    }),
  });
}
function focusAndPulse(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('pulse-ring');
  setTimeout(() => el.classList.remove('pulse-ring'), 1400);
}

function AddressCQsDialog({
  open,
  onClose,
  viewIndex,
  deliberationId,
  missingByClaim,
  targetClaim,
  setTargetClaim,
  claimsById,
  cqById,
  claimIdsInView,
}: {
  open: boolean;
  onClose: () => void;
  viewIndex: number;
  deliberationId: string;
   missingByClaim: Record<number, Record<string, Array<{ schemeKey: string; cqKey: string }>>>;
  targetClaim: string | null;
  setTargetClaim: (id: string) => void;
  claimsById: Map<string, string>;
  cqById: Map<string, CqSummary>;
  claimIdsInView: string[];
}) {
  // claims with open CQs in this view
  // const openClaimIds = Object.keys(missingByClaim[viewIndex] || {});
  // const openCQsFor = (cid: string | null) =>
  //    (cid ? (missingByClaim[viewIndex]?.[cid] ?? []) : []) as Array<{ schemeKey: string; cqKey: string }>;

   const opensMap = missingByClaim[viewIndex] || {};
  const openCQsFor = (cid: string | null) => (cid ? (opensMap[cid] ?? []) : []);

     // build the left list: all claims in this view, sorted by open count desc
     const claimsLeft = React.useMemo(() => {
       const scored = (claimIdsInView ?? []).map((cid) => {
         const sum = cqById.get(cid);
         const open = sum ? (sum.required - sum.satisfied) : 0;
         return { cid, open };
       });
       scored.sort((a, b) => b.open - a.open || (claimsById.get(a.cid)?.localeCompare(claimsById.get(b.cid) ?? '') || 0));
       return scored.map(s => s.cid);
     }, [claimIdsInView, cqById, claimsById]);
   
    const idxOf = (cid: string | null) => (cid ? claimsLeft.indexOf(cid) : -1);  const goRel = (delta: number) => {
      if (!claimsLeft.length) return;
    const i = idxOf(targetClaim);
    const next = i < 0 ? 0 : (i + delta + claimsLeft.length) % claimsLeft.length;
      setTargetClaim(claimsLeft[next]);
  };

  // local quick-actions state (hook-safe here)
  const [posting, setPosting] = React.useState<'WHY' | 'GROUNDS' | null>(null);
  const [ok, setOk] = React.useState<null | 'WHY' | 'GROUNDS'>(null);
  const [note, setNote] = React.useState('');
     const openCQs = openCQsFor(targetClaim);
     const [selectedCQ, setSelectedCQ] = React.useState<{schemeKey:string; cqKey:string} | null>(openCQs[0] ?? null);
     React.useEffect(()=>{ setSelectedCQ(openCQs[0] ?? null); setNote(''); }, [viewIndex, targetClaim]);
  
     async function post(kind: 'WHY' | 'GROUNDS') {
    if (!targetClaim) return;
    setPosting(kind);
    setOk(null);
    try {
       const ctrl = new AbortController();
     const to = setTimeout(() => ctrl.abort(), 12000);
     const payload = {
         schemeKey: selectedCQ?.schemeKey,
         // server expects cqId (not cqKey) in other parts of your UI; align here too
         cqId: selectedCQ?.cqKey,
         ...(kind === 'GROUNDS' ? { expression: note } : {})
       };
      await fetch('/api/dialogue/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deliberationId,
          targetType: 'claim',
          targetId: targetClaim,
          kind,
          payload,
          autoCompile: true,
          autoStep: true,
        }),
         signal: ctrl.signal,
      });
       clearTimeout(to);
      window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
      setOk(kind);
      setTimeout(() => setOk(null), 1200);

      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          // optional: surface a toast here
     console.warn('CQ move failed', e);
        }
    }
    setPosting(null);
  }

  const selectedSummary = targetClaim ? cqById.get(targetClaim) : undefined;
  const satisfied = selectedSummary?.satisfied ?? 0;
  const required = selectedSummary?.required ?? 0;

  // small search on left list
  const [filterQ, setFilterQ] = React.useState('');
  const filteredIds = claimsLeft.filter((cid) =>
      (claimsById.get(cid) ?? cid).toLowerCase().includes(filterQ.toLowerCase()),
  );

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white  max-w-[1400px] w-full rounded-xl max-h-[820px] overflow-hidden sm:max-w-[880px] p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle>Address Critical Questions — View {viewIndex   + 1}</DialogTitle>
          {targetClaim && (
            <div className="mt-1 text-[11px] text-neutral-600">
              Claim: “{(claimsById.get(targetClaim) ?? targetClaim).slice(0, 120)}”
            </div>
          )}
        </DialogHeader>

        {/* Two-pane layout */}
        <div className="grid grid-cols-[240px_1fr] gap-0 h-[560px]">
          {/* LEFT: Claim picker */}
          <aside className="border-r p-3 bg-slate-50">
            <input
              className="w-full border rounded px-2 py-1 text-[12px] mb-2"
              placeholder="Search claims…"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
            />
            <div className="text-[11px] text-neutral-600 mb-2">
            Claims in this view: <b>{claimsLeft.length}</b>
            </div>
            <div className="space-y-1 overflow-y-auto h-[480px] pr-1">
              {filteredIds.map((cid) => {
                const sum = cqById.get(cid);
                const open = (sum?.required ?? 0) - (sum?.satisfied ?? 0);
                const active = targetClaim === cid;
                return (
                  <button
                    key={cid}
                    className={`w-full text-left text-[12px] px-2 py-1 rounded border ${
                      active
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-neutral-200 hover:bg-neutral-50'
                    }`}
                    onClick={() => setTargetClaim(cid)}
                    title={claimsById.get(cid) ?? cid}
                  >
                    {(claimsById.get(cid) ?? cid).slice(0, 80)}
                              <span className={`ml-1 ${open>0?'text-amber-700':'text-neutral-400'}`}>· {open} open</span>

                  </button>
                );
              })}
            </div>
          </aside>

          {/* RIGHT: Claim details + quick actions */}
          <section className="p-4 space-y-3">
            <div className="text-[12px] text-neutral-600">
              CQs satisfied: <b>{satisfied}</b> / {required}
            </div>
              {targetClaim ? (
    <div className="mt-2 h-[490px] overflow-y-auto rounded border">
      <CriticalQuestions
       key={targetClaim}  
        targetType="claim"
        targetId={targetClaim}
    
        deliberationId={deliberationId}
          prefilterKeys={openCQsFor(targetClaim).length ? openCQsFor(targetClaim) : undefined}

        />
    </div>
  ) : (
    <div className="text-[11px] text-neutral-500">Pick a claim on the left to address its CQs.</div>
  )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// (2) Small helper to assemble Γ/Δ (ids + texts) for a view.
function buildSequentForView(
  v: View,
  // all claim ids mapped from this view’s arguments (fallback Γ)
  fallbackViewClaimIds: string[],
  // { claimId -> text }
  claimsById: Map<string, string>
) {
  // Γ: manual override if present, else all claims in the view
  const gammaIds = (v.gammaClaimIds?.length ? v.gammaClaimIds : fallbackViewClaimIds) ?? [];
  const dedupe = (xs: string[]) => Array.from(new Set(xs));

  // Δ: manual override if present, else the first 1–3 of Γ as the view's main conclusions
  const deltaIds =
    v.deltaClaimIds?.length
      ? v.deltaClaimIds
      : dedupe(gammaIds).slice(0, Math.min(3, gammaIds.length));

  const gammaTexts = dedupe(gammaIds).map((id) => claimsById.get(id) ?? id);
  const deltaTexts = dedupe(deltaIds).map((id) => claimsById.get(id) ?? id);

  return { gammaIds: dedupe(gammaIds), deltaIds: dedupe(deltaIds), gammaTexts, deltaTexts };
}

export function ViewControls({ rule, k, onApply }: { rule: Rule; k: number; onApply: (next:{rule:Rule;k:number})=>void; }) {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<Rule>(rule);
  const [kk, setK] = useState<number>(k);
  useEffect(()=>{ setR(rule); setK(k); },[rule,k]);
  return (
    <div className="relative">
      <button className="text-xs px-2 py-1 border rounded-xl bg-slate-200/50" onClick={()=>setOpen(v=>!v)} title="View settings">⚙️</button>
      {open && (
        <div className="absolute right-0 mt-2 z-20 bg-white border rounded p-3 w-56 text-xs shadow-lg">
          <label className="block mb-3">
            <span className="block mb-1 text-[11px] text-slate-600">Rule</span>
            <select className="w-full border rounded px-2 py-1" value={r} onChange={e=>setR(e.target.value as Rule)}>
              <option value="utilitarian">Utilitarian</option>
              <option value="harmonic">Harmonic</option>
              <option value="maxcov">MaxCov</option>
            </select>
          </label>
          <label className="block mb-3">
            <span className="block mb-1 text-[11px] text-slate-600">k = {kk}</span>
            <input type="range" min={2} max={7} value={kk} onChange={e=>setK(Number(e.target.value))} className="w-full"/>
          </label>
          <div className="flex justify-end gap-3">
            <button className="underline" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="px-2 py-1 border rounded" onClick={()=>{onApply({rule:r,k:kk}); setOpen(false);}}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}


function ViewMenu({
  deliberationId,
  primaryClaimId,
  onAfter,
}: { deliberationId: string; primaryClaimId?: string; onAfter?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirmOnly() {
    if (!primaryClaimId) return;
    setBusy(true);
    try {
      await fetch('/api/dialogue/panel/confirm', {
        method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({
          deliberationId,
          kind: 'epistemic',
          subject: { type:'claim', id: primaryClaimId },
          rationale: 'CQ satisfied; AF=IN',
          inputs: { via: 'RV' },
        }),
      });
      window.dispatchEvent(new CustomEvent('decision:changed', { detail:{ deliberationId } }));
      onAfter?.();
    } finally { setBusy(false); setOpen(false); }
  }

  async function confirmAndOpenVote() {
    if (!primaryClaimId) return;
    setBusy(true);
    try {
      // 1) confirm
      await fetch('/api/dialogue/panel/confirm', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          deliberationId,
          kind: 'epistemic',
          subject: { type:'claim', id: primaryClaimId },
          rationale: 'CQ satisfied; AF=IN',
          inputs: { via: 'RV' },
        }),
      });

      // 2) open a quick approval vote for the claim
      await fetch('/api/votes/sessions', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          deliberationId,
          subjectType: 'claim',
          subjectId: primaryClaimId,
          method: 'approval',
          options: [{ id:'approve', label:'Approve' }, { id:'reject', label:'Reject' }],
          closesAt: new Date(Date.now()+72*3600e3).toISOString(),
          quorumMinCount: 5,
          quorumMinPct: 0.1,
        }),
      });

      window.dispatchEvent(new CustomEvent('decision:changed', { detail:{ deliberationId } }));
      window.dispatchEvent(new CustomEvent('votes:changed',    { detail:{ deliberationId } }));
      onAfter?.();
    } finally { setBusy(false); setOpen(false); }
  }

  return (
    <div className="relative">
      <button className="flex text-[11px] text-center align-center p-2 btnv2  rounded-full " onClick={()=>setOpen(v=>!v)} title="Moderator actions"> </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-48 rounded border-2 border-indigo-100 bg-white shadow">
          <button className="block w-full text-left px-2 py-1 text-[12px] hover:bg-slate-100" onClick={confirmOnly} disabled={busy || !primaryClaimId}>Confirm</button>
          <button className="block w-full text-left px-2 py-1 text-[12px] hover:bg-slate-100" onClick={confirmAndOpenVote} disabled={busy || !primaryClaimId}>Confirm → Open vote</button>
          <button className="block w-full text-left px-2 py-1 text-[12px] hover:bg-slate-100" onClick={()=>setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}



export function RepresentativeViewpoints(props: {
  selection: {
    id: string;
    deliberationId: string;
    rule: Rule;
    k: number;
    coverageAvg: number;
    coverageMin: number;
    jrSatisfied: boolean;
    bestPossibleAvg?: number;
    conflictsTopPairs?: { a: string; b: string; count: number }[];
    views: View[];
  } | null;
  onReselect?: (rule?: Rule, k?: number) => void;
}) {
  const s = props.selection;
  useServerEvents(s?.deliberationId);

  // ---- gather argument ids across all views (stable hooks) ----
  const allArgIds = useMemo(() => {
    const ids = new Set<string>();
    s?.views?.forEach(v => v.arguments?.forEach(a => ids.add(a.id)));
    return [...ids];
  }, [s]);

  // map arguments → claimIds (for CQ aggregation)
  const argCsv = allArgIds.length ? allArgIds.sort().join(',') : '';
  const { data: argMapData } = useSWR<{ items: { id: string; claimId: string|null }[] }>(
    argCsv && s?.deliberationId
      ? `/api/arguments/batch?ids=${encodeURIComponent(argCsv)}&deliberationId=${encodeURIComponent(s.deliberationId)}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const argToClaim = useMemo(() => {
    const m = new Map<string,string>();
    (argMapData?.items ?? []).forEach(r => { if (r.claimId) m.set(r.id, r.claimId); });
    return m;
  }, [argMapData]);

  // claims per view + union
  const viewClaimIds = useMemo(() => {
    return (s?.views ?? []).map(v => {
      const ids = v.arguments.map(a => argToClaim.get(a.id)).filter(Boolean) as string[];
      return [...new Set(ids)];
    });
  }, [s, argToClaim]);

    const unionClaimIds = useMemo(() => [...new Set(viewClaimIds.flat())], [viewClaimIds]);

    // also include IDs mentioned in conflictsTopPairs (they can be claim IDs)
    const conflictIds = useMemo(
      () => [...new Set((s?.conflictsTopPairs ?? []).flatMap(p => [p.a, p.b]))],
      [s]
    );
    const claimIdsForFetch = useMemo(
      () => [...new Set([...unionClaimIds, ...conflictIds])],
      [unionClaimIds, conflictIds]
    );
  // batch CQ summary for all claims used by views
  const { byId: cqById } = useCQSummaryBatch(s?.deliberationId || '', unionClaimIds);

     // --- NEW: fetch claim texts so we can label conflict pairs & the claim picker ---
     const claimCsv = claimIdsForFetch.length ? claimIdsForFetch.sort().join(',') : '';
   const { data: claimMapData } = useSWR<{ items: { id: string; text: string }[] }>(
     claimCsv ? `/api/claims/batch?ids=${encodeURIComponent(claimCsv)}` : null,
     fetcher,
     { revalidateOnFocus: false }
   );
   const claimsById = useMemo(() => {
     const m = new Map<string, string>();
     (claimMapData?.items ?? []).forEach((r) => m.set(r.id, r.text));
     return m;
   }, [claimMapData]);
   const labelFor = (id: string) => (argsMap[id] ?? claimsById.get(id) ?? id);
    const anchorFor = (id: string) => `${argsMap[id] ? 'arg' : 'claim'}-${id}`;


  // cohort coverage for bars (optional)
  const { data: cohortData } = useSWR<CohortSummary>(
    s?.deliberationId
      ? `/api/deliberations/${s.deliberationId}/approvals/summary?cohorts=all,authors`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // build per-view missing CQs map (by claimId) — requires cqById, thus AFTER it
  const missingByClaim = useMemo(() => {
    return (s?.views ?? []).map((v, idx) => {
      const m: Record<string, Array<{ schemeKey: string; cqKey: string }>> = {};
      const claims = viewClaimIds[idx] || [];
      claims.forEach(cid => {
        const it = cqById.get(cid);
        if (!it) return;
        const arr: Array<{schemeKey:string; cqKey:string}> = [];
        Object.entries(it.openByScheme).forEach(([sk, keys]) => keys.forEach(k => arr.push({ schemeKey: sk, cqKey: k })));
        if (arr.length) m[cid] = arr;
      });
      return m;
    });
  }, [s, viewClaimIds, cqById]);
  const [openSequentView, setOpenSequentView] = useState<number | null>(null);

  // modal state per view
  const [openCQView, setOpenCQView] = useState<number | null>(null);
  const [targetClaim, setTargetClaim] = useState<string | null>(null);
  function openAddressCQs(viewIdx: number) {
    const m = missingByClaim[viewIdx] || {};
  const first = Object.keys(m)[0] || (viewClaimIds[viewIdx]?.[0] ?? null);
    setTargetClaim(first);
    setOpenCQView(viewIdx);
  }

     // SSE: refresh when dialogue/decisions/votes change
   useEffect(() => {
     if (!s?.deliberationId) return;
     const es = new EventSource(`/api/bus/sse?deliberationId=${encodeURIComponent(s.deliberationId)}`);
     es.onmessage = (ev) => {
       try {
         const e = JSON.parse(ev.data);
         // selectively mutate keys you rely on:
         // - CQ summaries
         // - arguments batch
         // - claims batch
         // - decisions
         // You already have stable keys; revalidate lightly:
         // (You can call SWR mutate here if you import it; or fire a window event the pages already respond to.)
         window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
       } catch {}
     };
     return () => es.close();
  }, [s?.deliberationId]);

   // arg text   scope chips (C/P/I) — prefer the batch we already call
   // Extend /api/arguments/batch to include text   edge summary; client supports fallback.
      // Build argsMap   scopeMap from /api/arguments/batch (now returns text   edgesOut)
      const argsMap = useMemo(() => {
        const m: Record<string, string> = {};
        (argMapData?.items ?? []).forEach((a:any) => { m[a.id] = a.text ?? ''; });
        return m;
      }, [argMapData]);
      const scopeMap = useMemo(() => {
        const sc: Record<string,'inference'|'premise'|'conclusion'> = {};
        (argMapData?.items ?? []).forEach((a:any) => {
          const eo = a.edgesOut ?? [];
          if (eo.some((e:any)=>e.type==='undercut')) sc[a.id] = 'inference';
          else if (eo.some((e:any)=>e.type==='rebut' && e.targetScope==='premise')) sc[a.id] = 'premise';
          else if (eo.some((e:any)=>e.type==='rebut')) sc[a.id] = 'conclusion';
        });
        return sc;
     }, [argMapData]);
   // Event-driven refresh (no polling storms)
   useEffect(() => {
     const onRefresh = () => {
       // keys that matter inside this component
       // SWR will dedupe if nothing changed
       // (SWR hooks already mounted; they’ll revalidate automatically when we call globalMutate outside or refetch here)
     };
     window.addEventListener('dialogue:moves:refresh', onRefresh as any);
     window.addEventListener('dialogue:cs:refresh', onRefresh as any);
     window.addEventListener('mesh:loci-updated', onRefresh as any);
     return () => {
       window.removeEventListener('dialogue:moves:refresh', onRefresh as any);
       window.removeEventListener('dialogue:cs:refresh', onRefresh as any);
       window.removeEventListener('mesh:loci-updated', onRefresh as any);
     };
  }, []);

  const [showCore, setShowCore] = useState(false);
  const [pending, setPending] = useState(false);

  function JRBadge() {
    const chip = (
      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
        JR
      </span>
    );
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{chip}</TooltipTrigger>
          <TooltipContent className="text-[11px]">
            Guarantees at least one cohort of size ≥ n/k is fully represented.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  function ViewCohortBar({ argIds }: { argIds: string[] }) {
    const summary = cohortData;
    if (!summary) return null;
    const totals = summary.totals;
    const union = (cohort: string) => {
      const u = new Set<string>();
      for (const id of argIds) {
        const entries = summary.byArgument[id]?.[cohort] ?? [];
        entries.forEach(v => u.add(v));
      }
      return u.size;
    };
    const allPct = totals.all ? Math.round((union('all') / totals.all) * 100) : 0;
    const authorsPct = totals.authors ? Math.round((union('authors') / totals.authors) * 100) : 0;
    return (
      <div className="mt-2 space-y-1 text-[11px] text-neutral-600">
        <div className="flex items-center gap-2" title={`All: ${allPct}%`}>
          <span className="w-12">All</span>
          <div className="h-2 bg-slate-200 rounded w-28">
            <div className="h-2 bg-emerald-500 rounded" style={{ width: `${allPct}%` }} />
          </div>
          <span>{allPct}%</span>
        </div>
        <div className="flex items-center gap-2" title={`Authors: ${authorsPct}%`}>
          <span className="w-12">Authors</span>
          <div className="h-2 bg-slate-200 rounded w-28">
            <div className="h-2 bg-indigo-500 rounded" style={{ width: `${authorsPct}%` }} />
          </div>
          <span>{authorsPct}%</span>
        </div>
      </div>
    );
  }

  const humanReason =
    s?.rule === 'utilitarian' ? 'Chosen to maximize average coverage of approvals' :
    s?.rule === 'harmonic'    ? 'Chosen to balance average and fairness (harmonic weights)' :
                                'Chosen to maximize the count of fully represented voters (JR-oriented)';

  const ScopeChip = ({ scope }:{ scope?: 'inference'|'premise'|'conclusion' }) => {
    if (!scope) return null;
    const style =
      scope === 'inference' ? 'border-violet-200 bg-violet-50 text-violet-700' :
      scope === 'premise'   ? 'border-amber-200 bg-amber-50 text-amber-700' :
                              'border-blue-200 bg-blue-50 text-blue-700';
    return (
      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${style}`}
        title={scope === 'inference' ? 'Undercuts the inference (warrant)' : scope === 'premise' ? 'Rebuts the premise' : 'Rebuts the conclusion'}>
        {scope}
      </span>
    );
  };

  if (!s) return <div className="rounded-md border p-4 text-xs text-neutral-500">No selection yet.</div>;


  return (
    <div className="relative z-10 w-full p-3 rounded-xl  mt-3  mb-1 panel-edge">
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-3 ">
          <h3 className="flex text-md font-semibold">
            Representative viewpoints (k={s.k}) {s.rule==='maxcov' && s.jrSatisfied && <JRBadge/>}
          </h3>
          <ViewControls rule={s.rule} k={s.k} onApply={({rule,k})=>props.onReselect?.(rule,k)} />
          <div className="inline-flex  text-center text-[11px] text-neutral-600">
          {`views: ${s.views.length} · rule: ${s.rule} · k: ${s.k}`}
          </div>
          {/* <div className="text-xs text-neutral-600">
            <WhyThis deliberationId={s.deliberationId} reason={humanReason}/>
          </div> */}
        </div>
        <div className="text-xs text-neutral-600 flex items-center gap-3">
          <span>
            Avg coverage: {((showCore ? s.bestPossibleAvg ?? s.coverageAvg : s.coverageAvg)*100).toFixed(0)}%
            {!showCore && <span> · Min: {(s.coverageMin*100).toFixed(0)}%</span>}
          </span>
          {typeof s.bestPossibleAvg === 'number' && (
            <label className="inline-flex items-center gap-1" title="Upper bound if you could pick the globally best set of k arguments.">
              <input type="checkbox" className="checkboxv2 rounded-full" checked={showCore} onChange={(e)=>setShowCore(e.target.checked)} />
              Best possible
            </label>
          )}
        </div>
      </div>

      
      {s.rule==='maxcov' && <div className="text-[11px] text-emerald-700">JR guarantee: at least one group of size ≥ n/k is fully represented</div>}
       <div className="text-[11px] text-neutral-500">
</div>
{s.conflictsTopPairs?.length ? (
  <div className="flex text-[11px] text-neutral-600  py-1">
    Conflicts:&nbsp;
    {s.conflictsTopPairs.slice(0,3).map((p,i)=>(
      <button
        key={i}
        className="mr-2 underline hover:text-emerald-700"
        title="Scroll to both items"
        onClick={() => { focusAndPulse(anchorFor(p.a)); focusAndPulse(anchorFor(p.b)); }}
      >
        “{labelFor(p.a).slice(0,60)}” × “{labelFor(p.b).slice(0,60)}” 
      </button>
    ))}
  </div>
) : null}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, s.views.length)}, minmax(0,1fr))`}}>
      { s.views.map(v => {
  // Build Γ/Δ via helper (manual overrides win; else fallback to claims in the view)
  const seq = buildSequentForView(
    v,
    viewClaimIds[v.index] || [],
    claimsById
  );
  const primaryConclusionId = seq.deltaIds?.[0]; // may be undefined if Δ empty

  const claims = viewClaimIds[v.index] || [];

  // aggregate CQ across claims in this view
  const agg = claims.reduce((acc, cid) => {
    const it = cqById.get(cid);
    if (it) { acc.satisfied += it.satisfied; acc.required += it.required; acc.openByScheme.push(it.openByScheme); }
    return acc;
  }, { satisfied: 0, required: 0, openByScheme: [] as Record<string,string[]>[] });

  const mergedOpen: Record<string,string[]> = {};
  agg.openByScheme.forEach(m =>
    Object.entries(m).forEach(([sk, arr]) => {
      if (!mergedOpen[sk]) mergedOpen[sk] = [];
      mergedOpen[sk]!.push(...arr);
    })
  );

  async function confirmEpistemicThenOpenVote(claimId: string) {
    // 1) Panel confirm
    await fetch('/api/dialogue/panel/confirm', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({
        deliberationId: s?.deliberationId,
        kind: 'epistemic',
        subject: { type:'claim', id: claimId },
        rationale: 'CQ satisfied, AF=IN',
        inputs: { /* cq / af snapshots if you want */ },
      }),
    });
  
    // 2) Open vote
    await fetch('/api/votes/sessions', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({
        deliberationId: s?.deliberationId, subjectType:'option', subjectId:'policy-fee',
        method:'approval',
        options:[{id:'o5',label:'$5'},{id:'o10',label:'$10'},{id:'o0',label:'$0'}],
        closesAt:new Date(Date.now()+72*3600e3).toISOString(),
        quorumMinCount:20, quorumMinPct:0.2,
      }),
    });
  }


  async function panelConfirmClaim(claimId: string) {
    // fetch AF labels if you don’t already have them
    const delibId = s?.deliberationId
    const af = await fetch(`/api/claims/labels?deliberationId=${delibId}`).then(r=>r.json()).catch(()=>null);
  
    await fetch('/api/dialogue/panel/confirm', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({
        deliberationId:s?.deliberationId,
        kind: 'epistemic',
        subject: { type:'claim', id: claimId },
        rationale: 'CQ satisfied, AF=IN',
        inputs: { cq: await (await fetch(`/api/claims/${claimId}/cq/summary`).then(r=>r.json()).catch(()=>({}))), af },
      }),
    });
  }

  return (
    <div key={v.index} className="border border-indigo-50 bg-slate-100/70 shadow-sm shadow-slate-800/50 rounded-lg px-2.5 py-1.5 space-y-2 mt-2.5 mb-2.5 mx-.5">
      <div className="flex items-center justify-between">
  <div className="text-xs uppercase tracking-wide text-neutral-500">View {v.index+1}</div>
  <div className="flex items-center gap-2">
    <StyleDensityBadge texts={v.arguments.map(a => a.text || '')} />
    <ViewMenu
      deliberationId={s.deliberationId}
      primaryClaimId={primaryConclusionId}
      onAfter={() => {
        // light revalidate
        window.dispatchEvent(new CustomEvent('decision:changed', { detail: { deliberationId: s.deliberationId } }));
      }}
    />
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="btnv2 rounded-full px-2 py-1  " aria-label="View actions">
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-[12px]">
        <DropdownMenuItem onClick={() => openAddressCQs(v.index)}>Open all CQs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => panelConfirmClaim(seq.deltaIds[0] )}>
  Confirm CQ/AF for this view
</DropdownMenuItem>
<DropdownMenuItem onClick={() => confirmEpistemicThenOpenVote(seq.deltaIds[0])}>
  Confirm CQ/AF → Open vote
</DropdownMenuItem>
        <DropdownMenuItem onClick={() => copySequentToClipboard(seq)}>Copy Γ/Δ as text</DropdownMenuItem>
        <DropdownMenuItem onClick={() => sendGammaToDialogue(s.deliberationId, seq.gammaTexts)}>Send Γ to dialogue</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportAsCard(s.deliberationId, seq.deltaTexts[0], seq.gammaTexts)}>Export as card</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>

      <ul className="space-y-2">
         {v.arguments.slice(0,6).map(a => (
           <li key={a.id} id={`arg-${a.id}`} className="text-xs">
            <div className="flex items-center gap-2">
              <span className="block text-sm">{a.text}</span>
              
              <ScopeChip scope={scopeMap?.[a.id]} />
              {(() => {
                const cid = argToClaim.get(a.id);
                const sum = cid ? cqById.get(cid) : undefined;
                if (!cid || !sum) return null;
                const open = (sum.required ?? 0) - (sum.satisfied ?? 0);
                if (open <= 0) return null;
                return (
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    title="View critical questions for this claim"
                    onClick={() => { setTargetClaim(cid); setOpenCQView(v.index); }}
                  >
                    CQs {sum.satisfied}/{sum.required}
                  </button>
                );
              })()}
            </div>
            {a.confidence!=null && (
              <span className="text-[11px] text-neutral-500">
                How sure: {(a.confidence*100).toFixed(0)}%
              </span>
            )}
          </li>
        ))}
      </ul>

   
      {/* Sequent status: Γ ⊢ Δ */}
      {seq.gammaTexts.length && seq.deltaTexts.length ? (
        <>
          <SequentBadge
            gammaTexts={seq.gammaTexts}
            deltaTexts={seq.deltaTexts}
            onClick={() => setOpenSequentView(i => i === v.index ? null : v.index)}
          />
          {openSequentView === v.index && (
            <SequentDetails
              gammaTexts={seq.gammaTexts}
              deltaTexts={seq.deltaTexts}
              onInsertTemplate={(tmpl) => {
                window.dispatchEvent(
                  new CustomEvent('mesh:composer:insert', { detail: { template: tmpl } })
                );
                setOpenSequentView(null);
              }}
            />
          )}
        </>
      ) : null}

      <ViewCohortBar argIds={v.arguments.map((a) => a.id)} />

      {/* <div className="mt-1 pb-1 relative z-10 flex items-center align-center gap-4">
        <div className="rounded-md border border-transparent">
        <CQBar satisfied={agg.satisfied} required={agg.required} compact />
        </div>
        <button
          className="text-[11px] border px-2 bg-white/50 rounded-md btnv2--ghost py-1"
          onClick={() => openAddressCQs(v.index)}
          disabled={!agg.required}
          title="Open Critical Questions for this view"
        >
          Address CQs
        </button>
      </div> */}

      <AddressCQsDialog
  open={openCQView === v.index}
  onClose={() => setOpenCQView(null)}
  viewIndex={v.index}
  deliberationId={s.deliberationId /* or selection.deliberationId */}
  missingByClaim={missingByClaim}
  targetClaim={targetClaim}
  setTargetClaim={setTargetClaim}
  claimsById={claimsById}
  cqById={cqById}
  claimIdsInView={viewClaimIds[v.index] || []}
/>

      {openCQView===v.index && (
        <div className="mt-1 rounded border p-2 bg-white text-[11px]">
          <div className="font-semibold mb-1">Open critical questions</div>
          <ul className="list-disc ml-5">
            {Object.entries(mergedOpen).map(([sk, arr])=>(
              <li key={sk}><span className="font-medium">{sk}</span>: {arr.slice(0,8).join(', ')}</li>
            ))}
          </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col justify-start">
        <button className="text-xs p-1.5 text-start underline underline-offset-4 disabled:opacity-50"
          disabled={pending}
          onClick={async ()=>{ setPending(true); try { props.onReselect?.(s.rule, s.k); } finally { setPending(false); } }}>
          {pending ? 'Refreshing…' : 'Refresh Views'}
        </button>
 
      </div>
    </div>
  );
}
