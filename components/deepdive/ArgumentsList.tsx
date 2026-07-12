//This is a legacy, obselete file kept for reference. Please do not edit or use this file.

"use client";
import { useMemo, useState, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import useSWR from "swr";
import { Virtuoso } from "react-virtuoso";
import PromoteToClaimButton from "../claims/PromoteToClaimButton";
import CitePickerInline from "@/components/citations/CitePickerInline";
import { SkeletonLines } from "@/components/ui/SkeletonB";
import React from "react";
import RhetoricText from "../rhetoric/RhetoricText";
import StyleDensityBadge from "@/components/rhetoric/StyleDensityBadge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Hit } from "../rhetoric/detectors";
import SaveHighlights from "../rhetoric/SaveHighlights";
import EmotionBadge from "@/components/rhetoric/EmotionBadge";
import FrameChips from "@/components/rhetoric/FrameChips";
import { analyzeLexiconsMany } from "../rhetoric/lexiconAnalyzers";
import CitePickerInlinePro from "@/components/citations/CitePickerInlinePro";
import CitePickerModal from "@/components/citations/CitePickerModal";
import DiagramView from "../map/DiagramView";
import type { Diagram } from "../map/DiagramView";
import Spinner from "../ui/spinner";
import { DecisionBanner } from "../decision/DecisionBanner";
// import CitePickerInline from "@/components/citations/CitePickerInline";
import { scrollIntoViewById } from "@/lib/client/scroll";
// Mini-ML
import { useRhetoric } from "@/components/rhetoric/RhetoricContext";
import { analyzeText } from "@/components/rhetoric/detectors";
import { featuresFromPipeline, predictMix } from "@/lib/rhetoric/mlMini";
import { MixBadge } from "@/components/rhetoric/MixBadge";
import { TargetType } from "@prisma/client";
import { SourceQualityBadge } from "../rhetoric/SourceQualityBadge";
import { FallacyBadge } from "../rhetoric/FallacyBadge";
import MethodChip from "@/components/rhetoric/MethodChip";

import DialogueMoves from "@/components/dialogue/DialogueMoves";
import AnchorToMapButton from "../map/AnchorToMapButton";
import MiniStructureBox from "../rhetoric/MiniStructureBox";
import DialogicalPanel from "@/components/dialogue/DialogicalPanel";
import NegotiationDrawerV2 from "@/components/map/NegotiationDrawerV2";
import { useDeliberationAF } from "../dialogue/useGraphAF";
import { ToulminBox } from "../monological/ToulminBox";
import { QuantifierModalityPicker } from "../monological/QuantifierModalityPicker";

import { LegalMoveChips } from "../dialogue/LegalMoveChips";
import { useLudicsPhase } from '@/components/dialogue/useLudicsPhase';


// Dialectic + RSA
import { useDialecticStats } from "@/packages/hooks/useDialecticStats";
import { DialBadge } from "@/packages/components/DialBadge";
import { RSAChip } from "@/packages/components/RSAChip";
import { useRSABatch } from "@/packages/hooks/useRSABatch";
import IssuesDrawer from "@/components/issues/IssuesDrawer";
import { IssueBadge } from "@/components/issues/IssueBadge";

import IssueComposer from "@/components/issues/IssueComposer";
import CriticalQuestions from "../claims/CriticalQuestions";
import { LudicsBadge } from "@/components/dialogue/LudicsBadge";
import { InlineMoveForm } from "@/components/dialogue/InlineMoveForm";
import MonologicalToolbar from "@/components/monological/MonologicalToolbar";
import { useAuth } from "@/lib/AuthContext";

import { useDialogueTarget } from '@/components/dialogue/DialogueTargetContext';
import { MoveKind } from "@/lib/dialogue/types";
import { LegalMoveToolbar } from "@/components/dialogue/LegalMoveToolbar";
import { AttackMenuPro } from '@/components/arguments/AttackMenuPro';
 import { LegalMoveToolbarAIF } from "../dialogue/LegalMoveToolbarAIF";

const PAGE = 20;
const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  const NOOP: any = null;


type Arg = {
  id: string;
  text: string;
  confidence?: number | null;
  createdAt: string;
  authorId: string;
  mediaUrl?: string | null;
  claimId?: string | null;
  quantifier?: "SOME" | "MANY" | "MOST" | "ALL" | null;
  modality?: "COULD" | "LIKELY" | "NECESSARY" | null;
  mediaType?: "text" | "image" | "video" | "audio" | null;
  edgesOut?: Array<{
    type: "rebut" | "undercut";
    targetScope?: "premise" | "inference" | "conclusion";
  }>;
  approvedByUser?: boolean;
    approvalsCount?: number;
    conclusionClaimId?: string | null;
  schemeId?: string | null;               // new: populated by createArgument v0.5
};

type AifMeta = {
  id: string;
  scheme?: { id: string; key: string; name: string; slotHints?: { premises?: { role: string; label: string }[] } | null };
  conclusion?: { id: string; text: string };
  premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
  implicitWarrant?: { text: string } | null;
  attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number };
  cq?: { required: number; satisfied: number };
};


// --- Small UI helpers (AIF pills) ---
function SchemeBadge({ scheme }: { scheme?: AifMeta['scheme'] }) {
  if (!scheme) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 px-2 py-0.5 text-[11px]"
      title={scheme.slotHints?.premises?.length ? scheme.slotHints.premises.map(p => p.label).join(' · ') : scheme.name}
    >
      {scheme.name}
    </span>
  );
}
function CqMeter({ cq }: { cq?: { required: number; satisfied: number } }) {
  const r = cq?.required ?? 0, s = cq?.satisfied ?? 0;
  const pct = r ? Math.round((s / r) * 100) : 0;
  return (
    <span className="text-[10px] px-1 py-0.5 rounded border bg-white" title={r ? `${s}/${r} CQs satisfied` : 'No CQs yet'}>
      CQ {pct}%
    </span>
  );
}
function AttackCounts({ a }: { a?: AifMeta['attacks'] }) {
  if (!a) return null;
  return (
    <div className="inline-flex items-center gap-1 text-[11px]">
      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title="Supports (from other RAs)">+{/* supports not from this endpoint; kept for parity */}</span>
      <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200" title="Rebuts">{a.REBUTS ?? 0}</span>
      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Undercuts">{a.UNDERCUTS ?? 0}</span>
      <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200" title="Undermines premise">{a.UNDERMINES ?? 0}</span>
    </div>
  );
}

function ChipBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-100/70 px-[.72rem ] py-[.36rem] text-xs">
      {children}
    </div>
  );
}

function ClampedBody({
  text,
  lines = 4,
  onMore,
}: { text: string; lines?: number; onMore: () => void }) {
  return (
    <div className="relative">
      <div className="text-sm whitespace-pre-wrap line-clamp-4">{text}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/90 to-transparent dark:from-slate-900/80" />
      <button className="btnv2--ghost py-0 px-6 rounded btnv2--sm absolute right-0 bottom-0 translate-y-1 translate-x-2"
              onClick={onMore}>
        More
      </button>
    </div>
  );
}

function RowLexSnapshot({ text }: { text: string }) {
  const { liwcCounts, topFrames } = React.useMemo(
    () => analyzeLexiconsMany([text]),
    [text]
  );
  return (
    <span className="text-[10px] text-neutral-600 ml-2">
      certainty {liwcCounts.certainty} · tentative {liwcCounts.tentative} · neg{" "}
      {liwcCounts.negation}
      {topFrames.length ? (
        <> · frames {topFrames.map((f) => f.key).join("/")}</>
      ) : null}
    </span>
  );
}

// ---------- ArgumentsList (AIF-aware) ----------
export function AIFList({
  deliberationId,
  onChanged,
  onReplyTo,
  onVisibleTextsChanged,
}: {
  deliberationId: string;
  onChanged?: () => void;
  onReplyTo?: (opts: { argumentId: string }) => void;
  onVisibleTextsChanged?: (texts: string[]) => void;
}) {
  // 1) Base list (unchanged)
  const getKey = (idx: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = prev?.nextCursor ? `&cursor=${encodeURIComponent(prev.nextCursor)}` : '';
    return `/api/deliberations/${encodeURIComponent(deliberationId)}/arguments?limit=20${cursor}`;
  };
  const { data, error, size, setSize, isLoading } = useSWRInfinite(getKey, fetcher, { revalidateOnFocus: false });
  const pages = data ?? [];
  const rows: Arg[] = pages.flatMap(p => p?.items ?? []);

  // 2) AIF meta (batch if available → fallback to per-row)
  const ids = React.useMemo(() => rows.map(r => r.id), [rows]);
  const idsParam = ids.length ? `ids=${ids.map(encodeURIComponent).join(',')}` : '';
  const { data: aifBatch } = useSWR<{ items?: AifMeta[] }>(
    ids.length ? `/api/arguments/batch?${idsParam}&include=aif` : null,
    fetcher,
    { revalidateOnFocus: false }
  ); // If this is not implemented to return AIF meta yet, we fall back below.  :contentReference[oaicite:8]{index=8}

  // Per-argument fallback meta loader
  const [aifMap, setAifMap] = React.useState<Record<string, AifMeta>>({});
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const byId: Record<string, AifMeta> = {};
      // First use whatever batch gave us
      for (const it of (aifBatch?.items ?? [])) byId[it.id] = it;

      // Fill gaps with lightweight calls we already have
      const pending = ids.filter(id => !byId[id]);
      await Promise.all(pending.map(async (id) => {
        try {
          const meta = { id } as AifMeta;
          // premises & implicit warrant
          const aAss = await fetch(`/api/arguments/${id}/assumptions`).then(r => r.json()).catch(()=>NOOP);
          if (aAss?.premises) meta.premises = aAss.premises;
          if (aAss?.implicitWarrant) meta.implicitWarrant = aAss.implicitWarrant;

          // CQs (count → meter)
          const aCq = await fetch(`/api/arguments/${id}/cqs`).then(r => r.json()).catch(()=>NOOP);
          if (Array.isArray(aCq?.items)) {
            const req = aCq.items.length;
            const sat = aCq.items.filter((x: any) => x.status === 'answered').length;
            meta.cq = { required: req, satisfied: sat };
          }

          // Attacks (group on client if server doesn’t)
          const aAtk = await fetch(`/api/arguments/${id}/attacks`).then(r => r.json()).catch(()=>NOOP);
          if (Array.isArray(aAtk?.items)) {
            const g = { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
            for (const e of aAtk.items) {
              const t = (e.attackType ?? '').toUpperCase();
              if (t in g) (g as any)[t] += 1;
            }
            meta.attacks = g;
          }

          byId[id] = meta;
        } catch { /* ignore */ }
      }));

      if (!cancelled) setAifMap(byId);
    })();
    return () => { cancelled = true; };
  }, [ids.join(','), aifBatch?.items?.length]);

  // Also keep “visible texts” working (conclusion text preferred)
  React.useEffect(() => {
    if (!onVisibleTextsChanged) return;
    const texts: string[] = [];
    for (const r of rows) {
      const claimText = (aifMap[r.id]?.conclusion?.text) ?? '';
      const t = claimText || r.text || '';
      if (t) texts.push(t);
    }
    onVisibleTextsChanged(texts);
  }, [rows, aifMap, onVisibleTextsChanged]);

  if (isLoading && rows.length === 0) {
    return <div className="text-sm text-slate-500">Loading arguments…</div>;
  }
  if (error) {
    return <div className="text-sm text-rose-600">Failed to load arguments</div>;
  }

  return (
    <div className="space-y-2">
      {rows.map((a) => {
        const meta = aifMap[a.id] || aifBatch?.items?.find(x => x.id === a.id);
        const conclusionText = meta?.conclusion?.text; // prefer I-node text if present
        const title = conclusionText || a.text || a.id;

        return (
          <div key={a.id} className="rounded border bg-white/80 p-2">
            {/* Header line: conclusion + scheme + CQ/attacks */}
            <div className="flex items-start gap-2 justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium leading-snug">{title}</div>
                {/* Premises (chips) */}
                {!!(meta?.premises?.length) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {meta!.premises!.map(p => (
                      <span key={p.id} className="text-[11px] px-1.5 py-0.5 rounded-full border bg-slate-50">
                        {p.text || p.id}
                      </span>
                    ))}
                  </div>
                )}
                {/* Implicit warrant */}
                {!!meta?.implicitWarrant?.text && (
                  <div className="mt-1 text-[11px] px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800">
                    Warrant: {meta.implicitWarrant.text}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <SchemeBadge scheme={meta?.scheme} />
                  <CqMeter cq={meta?.cq} />
                </div>
                <AttackCounts a={meta?.attacks} />
              </div>
            </div>

            {/* Row actions (unchanged affordances) */}
            <div className="mt-2 flex items-center gap-3">
              {/* Dialogue moves toolbar targets argument IFF we have an argument id; else claim */}
              <LegalMoveToolbar
                deliberationId={deliberationId}
                targetType={a.id ? 'argument' : 'claim'}
                targetId={a.id ? a.id : (a.claimId || '')}
                onPosted={() => window.dispatchEvent(new CustomEvent('dialogue:moves:refresh', { detail:{ deliberationId } } as any))}
              />

              {/* Open argument-level CQs inline */}
              <CriticalQuestions
                targetType={'claim'}
                targetId={a.id}
                createdById="current"
                deliberationId={deliberationId}
              />

              {/* Attack menu */}
              <div className="ml-auto">
                <AttackMenuPro
                  deliberationId={deliberationId}
                  authorId={a.authorId ?? 'current'}
                  target={{
                    id: a.id,
                    conclusion: { id: meta?.conclusion?.id ?? (a.claimId || ''), text: conclusionText ?? '' },
                    premises: meta?.premises ?? []
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* pager */}
      {pages.at(-1)?.nextCursor && (
        <div className="pt-2">
          <button
            onClick={() => setSize(size + 1)}
            className="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50"
          >Load more</button>
        </div>
      )}
    </div>
  );
}

export default function ArgumentsList({
  deliberationId,
   selectedClaimId, // Add this prop
  onClaimClick, // Add this prop
  onReplyTo,
  onChanged,
  onVisibleTextsChanged,
}: {
  deliberationId: string;
   selectedClaimId?: string;
  onClaimClick?: (claimId: string) => void;
  onReplyTo: (id: string) => void;
  onChanged?: () => void;
  onVisibleTextsChanged?: (texts: string[]) => void;
}) {
  const [clusterId, setClusterId] = useState<string | undefined>(undefined);
  const { modelLens } = useRhetoric();
  const [negOpen, setNegOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);

    const [composerOpen, setComposerOpen] = useState(false);
  const [issueTargetId, setIssueTargetId] = useState<string | null>(null);
  const [issueInitialLabel, setIssueInitialLabel] = useState<string>('');

const [issueDrawerTargetId, setIssueDrawerTargetId] = useState<string | null>(null);

function openIssuesFor(argumentId: string) {
  setIssueDrawerTargetId(argumentId);
  setIssuesOpen(true);
}

  const handleOpenDispute = (argumentId: string, label: string) => {
    setIssueTargetId(argumentId);
    setIssueInitialLabel(label || '');
    setComposerOpen(true);
 };


 useEffect(() => {
  const handler = (ev: any) => {
    if (ev?.detail?.deliberationId !== deliberationId) return;
    setIssueDrawerTargetId(ev.detail.argumentId ?? null);
    setIssuesOpen(true);
  };
  window.addEventListener('issues:open', handler);
  return () => window.removeEventListener('issues:open', handler);
}, [deliberationId]);

<IssuesDrawer
  deliberationId={deliberationId}
  open={issuesOpen}
  onOpenChange={(o)=>{ setIssuesOpen(o); if (!o) setIssueDrawerTargetId(null); }}
  argumentId={issueDrawerTargetId ?? undefined}  // Drawer can treat as a filter
/>

  useEffect(() => {
    const handler = (ev: any) => {
      if (ev?.detail?.deliberationId !== deliberationId) return;
      const ids: string[] =
        ev.detail.clusterIds ||
        (ev.detail.clusterId ? [ev.detail.clusterId] : []);
      setClusterId(ids[0]);
      const el = document.getElementById("arguments-top");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("mesh:list:filterCluster", handler as any);
    return () =>
      window.removeEventListener("mesh:list:filterCluster", handler as any);
  }, [deliberationId]);

  const getKey = (index: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = index === 0 ? "" : `&cursor=${prev.nextCursor}`;
    const clusterQ = clusterId
      ? `&clusterId=${encodeURIComponent(clusterId)}`
      : "";
    return `/api/deliberations/${deliberationId}/arguments?limit=${PAGE}${cursor}&sort=createdAt:desc${clusterQ}`;
  };

  const { data, size, setSize, isValidating, error, mutate } = useSWRInfinite(
    getKey,
    fetcher,
    {
          revalidateFirstPage: false,
          keepPreviousData: true,
          dedupingInterval: 1500,
          revalidateOnFocus: false,
    }
  );

  // Compute items FIRST so downstream hooks can depend on it
  const items: Arg[] = useMemo(
    () => (data ?? []).flatMap((d) => d.items),
    [data]
  );

  // AF slice for dialogical lens
  const { nodes, edges } = useDeliberationAF(deliberationId);

  // Claim IDs for work mapping
  const claimIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of items) if (a.claimId) set.add(a.claimId);
    return Array.from(set);
  }, [items]);

  // Map claimId -> { workId, title }
  const [workByClaimId, setWorkByClaimId] = useState<
    Record<string, { workId: string; title: string } | undefined>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!claimIds.length) {
        setWorkByClaimId({});
        return;
      }
      // 1) fetch claim citations
      const qs = encodeURIComponent(claimIds.join(","));
      const res = await fetch(`/api/claim-citations?claimIds=${qs}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        ok: boolean;
        citations: Record<string, string[]>;
      };
      if (!json.ok) return;

      // 2) detect workIds from citation URIs
      const workIdFromUri = (u: string) => {
        const m = u.match(/^\/works\/([^#?\/]+)/);
        return m?.[1];
      };

      const map: Record<string, { workId: string; title: string } | undefined> =
        {};
      const workIds = new Set<string>();
      for (const [cid, uris] of Object.entries(json.citations)) {
        const wid = uris?.map(workIdFromUri).find(Boolean);
        if (wid) {
          map[cid] = { workId: wid!, title: "" };
          workIds.add(wid!);
        }
      }

      if (!workIds.size) {
        if (!cancelled) setWorkByClaimId(map);
        return;
      }

      // 3) hydrate titles
      const idsQS = encodeURIComponent(Array.from(workIds).join(","));
      const resp = await fetch(`/api/works/by-ids?ids=${idsQS}`);
      if (!resp.ok) {
        if (!cancelled) setWorkByClaimId(map);
        return;
      }
      const j = (await resp.json()) as {
        ok: boolean;
        works: { id: string; title: string }[];
      };
      const titleById = Object.fromEntries(
        (j.works ?? []).map((w) => [w.id, w.title])
      );
      for (const cid of Object.keys(map)) {
        const wid = map[cid]!.workId;
        map[cid]!.title = titleById[wid] ?? "Work";
      }
      if (!cancelled) setWorkByClaimId(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [claimIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // RSA (batch for first ~20) + Dialectic stats once
  const argTargets = React.useMemo(() => {
    const ids = (items ?? []).slice(0, 20).map((a) => `argument:${a.id}`);
    return Array.from(new Set(ids));
  }, [items]);

  const { byTarget: rsaByTarget } = useRSABatch({
    deliberationId,
    targets: argTargets,
  });
  const { stats: dialStats } = useDialecticStats(deliberationId);

  const titlesByTarget = useMemo(
    () =>
      Object.fromEntries(items.map((a) => [a.id, (a.text || "").slice(0, 80)])),
    [items]
  );

  const { liwcCounts } = useMemo(
    () => analyzeLexiconsMany(items.slice(0, 10).map((a) => a.text || "")),
    [items]
  );

  useEffect(() => {
    onVisibleTextsChanged?.(items.slice(0, 40).map((a) => a.text || ""));
  }, [items, onVisibleTextsChanged]);

     // Allow rows to request opening the negotiation drawer
   useEffect(() => {
     const h = (e: any) => {
       if (e?.detail?.deliberationId !== deliberationId) return;
       setNegOpen(true);
     };
     window.addEventListener('ludics:open', h);
     return () => window.removeEventListener('ludics:open', h);
  }, [deliberationId]);

  const nextCursor = data?.[data.length - 1]?.nextCursor ?? null;

  const approve = async (id: string, approve: boolean) => {
    try {
      const res = await fetch(`/api/deliberations/${deliberationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ argumentId: id, approve }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged?.();
      mutate();
    } catch (e) {
      console.error("approve failed", e);
    }
  };

  if (!data && isValidating) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <div className="text-md font-medium">Arguments</div>
        <div className="p-2 border rounded">
          <SkeletonLines lines={3} />
        </div>
        <div className="p-2 border rounded">
          <SkeletonLines lines={3} />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <div className="text-md font-medium">Arguments</div>
        <div className="text-xs text-rose-600">
          {String(error?.message || "Failed to load")}
        </div>
        <button className="text-xs underline" onClick={() => mutate()}>
          Retry
        </button>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <div className="text-md font-medium">Arguments</div>
        <div className="text-xs text-neutral-600">
          No arguments yet — start by adding your <b>Point</b> and optional{" "}
          <b>Sources</b>.
        </div>
      </div>
    );
  }

  const virtuosoOverflowClass = listExpanded
    ? "overflow-y-auto"
    : "overflow-y-hidden";

  return (
    <div
      id="arguments-top"
      className="relative z-10 w-full px-2 rounded-xl pt-1 mt-3 pb-3 mb-1 panel-edge"
    >
      <div className="px-3 py-2.5 text-md font-medium flex items-center justify-between">
        <span>Arguments</span>
        <button
          type="button"
          className="relative max-w-[300px] w-full justify-center items-center text-center mx-auto px-4 py-2.5 
                     text-[11px] tracking-wider rounded-full lockbutton"
          onClick={() => setListExpanded((v) => !v)}
          aria-expanded={listExpanded}
        >
          {listExpanded ? "Lock Scrolling" : "Enable Scrolling"}
        </button>
        <button
          className="px-4 py-2 text-[11px] btnv2  rounded-full"
          onClick={() => { setIssueDrawerTargetId(null); setIssuesOpen(true); }}

        >
          Issues
        </button>
{/* {diag ? <DiagramView diagram={diag} /> : <Spinner/>} */}
        <IssuesDrawer
          deliberationId={deliberationId}
          open={issuesOpen}
          onOpenChange={setIssuesOpen}
          argumentId={issueDrawerTargetId ?? undefined}  // 👈 new prop

        />
        <IssueComposer
    deliberationId={deliberationId}
    initialArgumentId={issueTargetId ?? undefined}
    initialLabel={issueInitialLabel || undefined}
    open={composerOpen}
    onOpenChange={setComposerOpen}
    onCreated={() => {
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
    }}
  />
      </div>
      <div className="inline-flex gap-2">
        <StyleDensityBadge
          texts={items.slice(0, 10).map((a) => a.text || "")}
        />
        <EmotionBadge texts={items.slice(0, 10).map((a) => a.text || "")} />
        <FrameChips texts={items.slice(0, 10).map((a) => a.text || "")} />
      </div>
      <span className="ml-2 text-[11px] text-neutral-500">
        · Model: {modelLens}
      </span>
        {modelLens === 'monological' && (
    <DelibMixBadge deliberationId={deliberationId} />
  )}

      {liwcCounts && (
        <span className="ml-2 text-[11px] text-neutral-600">
          · certainty {liwcCounts.certainty} · tentative {liwcCounts.tentative}{" "}
          · negation {liwcCounts.negation}
        </span>
      )}

      <div className="rounded-md border py-1">
        {modelLens === "dialogical" && (
          <>
            <div className="flex items-center justify-between px-3 py-1">
              <div className="text-sm font-medium">Dialogical view</div>
              <button
                className="px-4 py-2 btnv2 rounded-full text-[11px]"
                onClick={async () => {
                  setNegOpen(true);
                  await fetch("/api/ludics/compile-step", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ deliberationId, phase: "neutral" }),
                  }).catch(() => {});
                  window.dispatchEvent(
                    new CustomEvent("dialogue:moves:refresh")
                  );
                }}
              >
                Negotiation Panel
              </button>
            </div>
            <DialogicalPanel
              deliberationId={deliberationId}
              nodes={nodes}
              edges={edges}
            />
            <div className="z-1000">
              <NegotiationDrawerV2
                deliberationId={deliberationId}
                open={negOpen}
                onClose={() => setNegOpen(false)}
                titlesByTarget={titlesByTarget}
              />
            </div>
          </>
        )}

        <div className="h-[500px] ">
          <Virtuoso
            className={virtuosoOverflowClass}
            data={items}
            computeItemKey={(_index, a) => a.id}
              increaseViewportBy={{ top: 240, bottom: 240 }}
  rangeChanged={(range) => {
    const slice = items.slice(range.startIndex, Math.min(items.length, range.endIndex +  1));
   onVisibleTextsChanged?.(slice.map(a => a.text || ''));
 }}
            endReached={() =>
              !isValidating && nextCursor && setSize((s) => s + 1)
            }
            itemContent={(index: number, a: Arg) =>
              modelLens === "dialogical" ? (
                <DialogicalRow
                  a={a}
                  deliberationId={deliberationId}
                  onReplyTo={onReplyTo}
                  onOpenDispute={handleOpenDispute}
          //  whyLocusPath={whyMeta?.locusPath /* "0.3" when known */}

                />
              ) : (
                <ArgRow
                  a={a}
                  deliberationId={deliberationId}
                  onReplyTo={onReplyTo}
                  onApprove={approve}
                  onOpenDispute={handleOpenDispute}
                  onOpenIssuesFor={openIssuesFor}   // 👈 pass through

                  refetch={mutate}
                  modelLens={modelLens as any}
                  workByClaimId={workByClaimId}
                  // NEW: pass RSA + Dial maps to the row
                  rsaByTarget={rsaByTarget}
                  dialStats={dialStats}
                />
              )
            }
            components={{
              Footer: () => (
                <div className="py-3 px-4 mx-4 text-center text-[12px] gap-4 text-neutral-500">
                  {isValidating
                    ? "Loading…"
                    : nextCursor
                    ? "Scroll to load more"
                    : "End"}
                </div>
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EvidenceChecklist({ text }: { text: string }) {
  const hasUrl = /\bhttps?:\/\/\S+/.test(text);
  const hasDoi = /\bdoi:\s*\S+/i.test(text) || /doi\.org\//i.test(text);
  const hasNum = /\b\d+(?:\.\d+)?\s?(%|percent|ratio|CI|R²|p[<=>])\b/i.test(
    text
  );
  const hasYear = /\b(19|20)\d{2}\b/.test(text);
  const pill = (ok: boolean, label: string) => (
    <span
      className={`px-1 py-0.5 rounded border text-[10px] ${
        ok
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-neutral-50 border-neutral-200 text-neutral-600"
      }`}
    >
      {label}
    </span>
  );
  return (
<div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white/60 px-1.5 py-1 backdrop-blur">
      {pill(hasUrl, "URL")}
      {pill(hasDoi, "DOI")}
      {pill(hasNum, "#s")}
      {pill(hasYear, "Year")}
    </div>
  );
}


function ClampReveal({
  id,
  text,
  lines = 4,
}: { id: string; text: string; lines?: number }) {
  const [open, setOpen] = React.useState<boolean>(() => {
    try { return localStorage.getItem(`dlgrow:${id}:open`) === '1'; } catch { return false; }
  });
  const [showDialog, setShowDialog] = React.useState(false);
  const [canExpand, setCanExpand] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  // Re-check overflow when text changes or we toggle
  React.useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Temporarily remove clamp to measure intrinsic height
    const prev = el.style.webkitLineClamp as any;
    el.style.webkitLineClamp = open ? 'unset' : String(lines);
    // give the browser a tick
    requestAnimationFrame(() => {
      const overflow = el.scrollHeight > el.clientHeight + 1;
      setCanExpand(overflow);
      el.style.webkitLineClamp = prev ?? '';
    });
  }, [text, open, lines]);

  function toggle() {
    setOpen((o) => {
      const n = !o;
      try { localStorage.setItem(`dlgrow:${id}:open`, n ? '1' : '0'); } catch {}
      return n;
    });
  }

  const gradient =
    'pointer-events-none absolute inset-x-0 bottom-0 h-8 ' +
    'bg-gradient-to-t from-white/90 to-transparent dark:from-slate-900/80'; // consistent glass fade

  return (
    <div className="relative group">
      {/* Body */}
      <div
        ref={bodyRef}
        className={[
          'text-sm whitespace-pre-wrap transition-all',
          open ? '' : `line-clamp-${lines}`,
        ].join(' ')}
        // Accessibility
        aria-expanded={open}
        id={`dlg-body-${id}`}
      >
        {text}
      </div>

      {/* Fade when clamped */}
      {!open && canExpand && <div className={gradient} />}

      {/* Controls */}
      {canExpand && (
        <div className="mt-1 flex items-center gap-2">
          <button
            className="btnv2--ghost btnv2--sm px-2 py-0.5 rounded"
            onClick={toggle}
            aria-controls={`dlg-body-${id}`}
          >
            {open ? 'Less' : 'More'}
          </button>

          {/* Open in dialog */}
          <button
            className="btnv2--ghost btnv2--sm px-2 py-0.5 rounded"
            onClick={() => setShowDialog(true)}
            title="Open full text"
          >
            Open full
          </button>
        </div>
      )}


      {/* Full-screen dialog (copy-friendly) */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Argument text</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm">
            {text}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="btnv2--ghost btnv2--sm rounded px-2 py-1"
              onClick={async () => {
                try { await navigator.clipboard.writeText(text); } catch {}
              }}
            >
              Copy
            </button>
            <button
              className="btnv2--ghost btnv2--sm rounded px-2 py-1"
              onClick={() => setShowDialog(false)}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------ Row component (now *receives* Dial & RSA maps) ------
type RSARes = { R: number; S: number; A: number };
function ArgRow({
  a,
  deliberationId,
  onReplyTo,
  onApprove,
  onOpenDispute,
  onOpenIssuesFor,     // 👈 NEW

  refetch,
  modelLens,
  workByClaimId,
  rsaByTarget,
  dialStats,
}: {
  a: Arg;
  deliberationId: string;
  onReplyTo: (id: string) => void;
  onApprove: (id: string, approve: boolean) => Promise<void> | void;
  onOpenDispute: (id: string, label: string) => Promise<void> | void;
  onOpenIssuesFor: (id: string) => void; // 👈 NEW

  refetch: () => void;
  modelLens: "monological" | "dialogical" | "rhetorical";
  workByClaimId: Record<string, { workId: string; title: string } | undefined>;
  rsaByTarget: Record<string, RSARes>;
  dialStats: Record<string, any> | undefined;
}) {
  const { settings } = useRhetoric();
  const [modalOpen, setModalOpen] = useState(false);
  const [lastHits, setLastHits] = useState<Hit[]>([]);

  const [citeOpen, setCiteOpen] = useState(false);
  const [prefillUrl, setPrefillUrl] = useState<string | undefined>(undefined);

  const { setTarget } = useDialogueTarget();
  

  const rowRef = React.useRef<HTMLDivElement | null>(null);
  // React.useEffect(() => {
  //   const el = rowRef.current;
  //   if (!el) return;
  //   function onKey(e: KeyboardEvent) {
  //     if (document.activeElement && !el.contains(document.activeElement)) return;
  //     if (e.key.toLowerCase() === 'r') { onReplyTo(a.id); scrollComposerIntoView(); }
  //     if (e.key.toLowerCase() === 'c') { setCiteOpen(true); }
  //   }
  //   el.addEventListener('keydown', onKey);
  //   return () => el.removeEventListener('keydown', onKey);
  // }, [a.id, onReplyTo]);
  function onOpenCitePicker(initialUrl?: string) {
    setPrefillUrl(initialUrl);
    setCiteOpen(true);
  }
  const [bridgeBusy, setBridgeBusy] = useState(false);
  async function openDialogue() {
    if (bridgeBusy) return;
    try {
      setBridgeBusy(true);
      await fetch("/api/monological/bridge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ argumentId: a.id }),
      });
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
    } finally {
      setBridgeBusy(false);
    }
  }

  async function onPromoteWithEvidence(url: string, conclusionText?: string) {
    // 1) promote (if you have conclusion from Toulmin)
    const claimText = conclusionText || a.text.slice(0, 120);
    const ccRes = await fetch("/api/claims/quick-create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetArgumentId: a.id,
        text: claimText,
        deliberationId,
      }),
    });
    if (!ccRes.ok) throw new Error(await ccRes.text());
    const { claimId } = await ccRes.json();

    // 2) attach evidence quickly
    const ev = await fetch(
      `/api/claims/${encodeURIComponent(claimId)}/evidence`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uri: url, kind: "secondary", cite: true }),
      }
    );
    if (!ev.ok) throw new Error(await ev.text());

    // 3) refresh row
    await refetch();
  }

  const created = new Date(a.createdAt).toLocaleString();
  const alt = a.text ? a.text.slice(0, 50) : "argument image";

  const miniMix = useMemo(() => {
    if (!settings.enableMiniMl || !a.text) return null;
    const det = analyzeText(a.text);
    const NLP_CATS = new Set([
      "imperative",
      "passive",
      "nominalization",
      "parallelism",
      "modal-certainty",
      "modal-uncertainty",
      "negation",
      "pronoun-you",
      "pronoun-we",
    ] as Hit["cat"][]);
    const nlpHits = lastHits?.filter((h) => NLP_CATS.has(h.cat)) ?? [];
    const feats = featuresFromPipeline({ det, nlpHits, text: a.text });
    return predictMix(feats, { temperature: 1.0 });
  }, [settings.enableMiniMl, a.text, lastHits]);
  const qmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  function saveQualifier(q: any, m: any) {
    if (qmTimer.current) clearTimeout(qmTimer.current);
    qmTimer.current = setTimeout(() => {
      fetch(`/api/arguments/${a.id}/qualifier`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantifier: q ?? null, modality: m ?? null }),
      })
        .then(() => refetch())
        .catch(() => {});
    }, 400);
  }



  const workChip =
    a.claimId && workByClaimId[a.claimId] ? (
      <a
        className="px-1.5 py-0.5 rounded border text-[10px] bg-neutral-50 hover:bg-neutral-100"
        href={`/works/${workByClaimId[a.claimId]!.workId}`}
        title="Open source work"
      >
        ⇢ Work: {workByClaimId[a.claimId]!.title || "Open"}
      </a>
    ) : null;

  // Pull batch RSA for this row
  const rsaForRow = rsaByTarget[`argument:${a.id}`];
  const { user } = useAuth();
    const viewerId =
      (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.uid ?? (user as any)?.sub ?? null;
    const isAuthor = viewerId != null && String(viewerId) === String(a.authorId);

  return (
    <div className="relative my-2  shadow-sm">
    <div id={`arg-${a.id}`} ref={rowRef} tabIndex={0} aria-label="Argument row"
 className="group relative p-3 border-b focus:outline-none
                                   bg-white/40 hover:bg-white/65 backdrop-blur-[2px] transition-colors">
                                    {/* <div
  id={`row-${a.id}`}
  onMouseEnter={() => window.dispatchEvent(new CustomEvent('mesh:select-node', { detail: { id: a.id } }))}
  onClick={() => window.dispatchEvent(new CustomEvent('mesh:select-node', { detail: { id: a.id } }))}
> */}
                                    
      {modelLens === "monological" && (
        <MonologicalToolbar
          deliberationId={deliberationId}
          argument={{ id: a.id, text: a.text, claimId: a.claimId ?? undefined }}
          // You can pass CQ summary bonus if you have it available here; else omit
          onChanged={() => refetch()}
        />
      )}


         {modelLens === "monological" && (
           <>
             <MiniStructureBox text={a.text} />
             <div className="px-2 py-1 border rounded-lg bg-slate-50/50 my-2">
             <ToulminBox
               text={a.text}
               argumentId={a.id}
               deliberationId={deliberationId}
               claimId={a.claimId ?? null}
               onChanged={() => refetch()}
               onAddMissing={(slot) => {
                 fetch('/api/missing-premises', {
                   method: 'POST', headers: { 'content-type': 'application/json' },
                   body: JSON.stringify({
                     deliberationId, targetType: 'argument', targetId: a.id,
                     text: slot === 'warrant' ? 'Add warrant…' : 'Add missing premise…',
                     premiseType: slot === 'warrant' ? 'warrant' : 'premise',
                   }),
                 }).catch(()=>{});
               }}
               onPromoteConclusion={(conclusion) => {
                 fetch('/api/claims/quick-create', {
                   method: 'POST', headers: { 'content-type': 'application/json' },
                   body: JSON.stringify({ targetArgumentId: a.id, text: conclusion, deliberationId }),
                 }).then(()=>refetch());
               }}
             />
             </div>
           </>
         )}

      {/* badges */}

      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
      {(a.quantifier || a.modality) && (
  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-1.5 py-1 text-[10px]">
    {a.quantifier && <span className="rounded border border-blue-200 bg-blue-50 px-1 text-blue-700">{a.quantifier}</span>}
    {a.modality && <span className="rounded border border-violet-200 bg-violet-50 px-1 text-violet-700">{a.modality}</span>}
  </span>
)}
        <div className="flex flex-col  ">

            <>
              <LudicsBadge
                deliberationId={deliberationId}
                targetType="argument"
                targetId={a.id}
              />
            <DecisionBanner deliberationId={deliberationId} subjectType="claim" subjectId={a.claimId ?? ""}/>
            <DecisionBanner
  deliberationId={deliberationId}
  subjectType="claim"
  subjectId={a.claimId ?? ""}
/>
              {/* <button
  className="text-[11px] px-2 py-0.5 border rounded"
  onClick={() => panelConfirmClaim(targetId)}
  title="Record a receipt confirming current CQ/AF state"
>
  Confirm (panel)
</button> */}
              <DialBadge
                stats={dialStats ?? {}}
                targetType="argument"
                targetId={a.id}
              />
              {rsaForRow && <RSAChip {...rsaForRow} />}
            </>
     

<IssueBadge
  deliberationId={deliberationId}
  targetType="argument"
 targetId={a.id}
 onClick={() => onOpenIssuesFor(a.id)}
/>


          {a.mediaType && a.mediaType !== "text" && (
            <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
              {a.mediaType}
            </span>
          )}
        </div>
        {modelLens === "monological" && (
          <div className="rounded-md bg-white/70 border p-1">
            <div className="flex flex-col  ">
              {modelLens === "monological" && <MethodChip text={a.text} />}

              <div className="border rounded px-1.5 py-0.5">
                {modelLens === "monological" && (
                  <RowLexSnapshot text={a.text} />
                )}
              </div>
              <div className="border rounded px-1.5 py-0.5">
                {modelLens === "monological" && (
                  <EvidenceChecklist text={a.text} />
                )}
              </div>
            </div>
            {modelLens === "monological" && isAuthor && (
              <QuantifierModalityPicker
                initialQuantifier={a.quantifier ?? null}
                initialModality={a.modality ?? null}
                onChange={saveQualifier}
              />
            )}
          </div>
        )}

        {workChip}

        {/* Mini ML */}
        {modelLens === "rhetorical" && (
          <>
            {miniMix && <MixBadge mix={miniMix} className="ml-auto  " />}
            {a.text && <SourceQualityBadge text={a.text} />}
            {a.text && <FallacyBadge text={a.text} />}
          </>
        )}
      </div>
      {modelLens === "dialogical" && (
        <>
          {/* Inline WHY */}
          <InlineMoveForm
            placeholder="Challenge this: WHY …"
            onSubmit={async (note) => {
              // optimistic nudge
              window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
              await fetch("/api/dialogue/move", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  deliberationId,
                  targetType: "argument",
                  targetId: a.id,
                  kind: "WHY",
                  payload: { note },
                  autoCompile: true,
                  autoStep: true,
                }),
              });
              // tell Ludics & drawer to refresh
              window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
            }}
          />

          {/* Inline GROUNDS */}
          <InlineMoveForm
            placeholder="Provide grounds…"
            onSubmit={async (brief) => {
              window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
              await fetch("/api/dialogue/move", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  deliberationId,
                  targetType: "argument",
                  targetId: a.id,
                  kind: "GROUNDS",
                  payload: { brief },
                  autoCompile: true,
                  autoStep: true,
                }),
              });
              window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
            }}
          />
        </>
      )}
      {/* <div className="text-[9px] text-neutral-500 mb-1 mt-1">{created}</div> */}
      <div className="text-[9px] text-neutral-500 mb-1 mt-1">
  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5">
    {created}
  </span>
</div>
{a.confidence != null && (

<div className="text-[9px] text-neutral-500 mb-1 mt-1">
  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5">
  Certainty: {(a.confidence * 100).toFixed(0)}%

  </span>
</div>
      )}

      {Array.isArray(a.edgesOut) && a.edgesOut.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {a.edgesOut.map((e, i) => {
            if (e.type !== "rebut" && e.type !== "undercut") return null;
            const label =
              e.type === "undercut"
                ? "inference"
                : e.targetScope ?? "conclusion";
            const style =
              label === "inference"
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : label === "premise"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-blue-200 bg-blue-50 text-blue-700";
            return (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${style}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* truncated body */}
      <div className="w-fit h-fit px-2 py-1 bg-white shadow-md shadow-slate-300/40 border mb-3 mt-2 rounded-md">

      {/* <div
        className={`text-sm whitespace-pre-wrap ${
          a.text.length > 240 && !modalOpen ? "line-clamp-3" : ""
        }`}
      >
        <RhetoricText text={a.text} onHits={setLastHits} />
      </div>

      {a.text && a.text.length > 240 && (
        <button
          className="text-xs underline mt-1"
          onClick={() => setModalOpen(true)}
        >
          Expand
        </button>
      )} */}
      {a.text.length > 240 && !modalOpen ? (
  <ClampedBody text={a.text} onMore={() => setModalOpen(true)} />
) : (
  <div className="text-sm whitespace-pre-wrap">
    <RhetoricText text={a.text} onHits={setLastHits} />
  </div>
)}
</div>
      {/* full body modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[500px] bg-slate-50 rounded-xl overflow-y-auto p-4 ">
          <DialogHeader>
            <DialogTitle>Full argument</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm">
            <RhetoricText text={a.text} onHits={setLastHits} />
            <hr className="w-full my-2"></hr>
            <div className="flex gap-3">
            <SaveHighlights
              targetType="argument"
              targetId={a.id}
              highlights={lastHits.map((h) => ({
                kind: h.cat,
                text: h.match,
                start: h.start,
                end: h.end,
              }))}
            />
                  <DialogClose
            id="closearg"
            className={`btnv2`}
          >
            Close
          </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* media */}
      {a.mediaType === "image" && a.mediaUrl && (
        <div className="mt-2">
          <img
            src={a.mediaUrl}
            alt={alt}
            loading="lazy"
            className="max-h-40 object-contain border rounded"
          />
        </div>
      )}
      {a.mediaType === "video" && a.mediaUrl && (
        <div className="mt-2">
          <video
            controls
            preload="metadata"
            className="max-h-52 border rounded"
          >
            <source src={a.mediaUrl} />
          </video>
        </div>
      )}
      {a.mediaType === "audio" && a.mediaUrl && (
        <div className="mt-2">
          <audio controls preload="metadata" className="w-full">
            <source src={a.mediaUrl} />
          </audio>
        </div>
      )}

      {/* {a.confidence != null && (
        <div className="text-[11px] text-neutral-500 mt-1">
          How sure: {(a.confidence * 100).toFixed(0)}%
        </div>
      )} */}
         <div className="flex " >  
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <button
          className="px-2 py-1 flex-none  rounded text-xs btnv2--ghost"
  onClick={() => onReplyTo(a.id)} // <-- send preview
        >
          Reply
        </button>

        {a.claimId ? (
    <span className="text-[11px] px-2 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700">
      Promoted ✓
    </span>
  ) : (

      <PromoteToClaimButton
        deliberationId={deliberationId}
        target={{ type: "argument", id: a.id }}
        onClaim={async (newClaimId) => {
          refetch();
          await fetch("/api/dialogue/move", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              deliberationId,
              targetType: "claim",
              targetId: newClaimId,
              kind: "ASSERT",
              payload: { note: "Promoted to Claim" },
              actorId: "Proponent",
              autoCompile: true,
              autoStep: true,
            }),
          }).catch(() => {});
          window.dispatchEvent(
            new CustomEvent("dialogue:moves:refresh")
          );
        }}
      />
    
  )}

        {a.approvedByUser ? (
          <button
            className="px-2 py-1 border rounded text-xs bg-emerald-50 border-emerald-300 text-emerald-700"
            onClick={() => onApprove(a.id, false)}
          >
            Approved ✓ (Unapprove)
          </button>
        ) : (
          <button
            className="px-2 py-1 btnv2--ghost  rounded text-xs"
            onClick={() => onApprove(a.id, true)}
          >
            Approve
          </button>
        )}
        <button
  className="px-2 py-1 btnv2--ghost rounded text-xs"
  onClick={() => {
    const url = `${location.origin}${location.pathname}#arg-${a.id}`;
    navigator.clipboard.writeText(url).catch(()=>{});
  }}
  title="Copy a direct link to this argument"
>
  Copy link
</button>
  <DiscussInLudicsButton
    deliberationId={deliberationId}
    argumentId={a.id}
    setTarget={setTarget}
  />
        {a.mediaType === "image" && (
          <>
            <button
              className="px-2 py-1  rounded text-xs btnv2--ghost"
              onClick={() => onOpenDispute(a.id, "Image – Relevance")}
            >
              Dispute image (Relevance)
            </button>
            <button
              className="px-2 py-1  rounded text-xs btnv2--ghost"
              onClick={() => onOpenDispute(a.id, "Image – Depiction")}
            >
              Dispute image (Depiction)
            </button>
          </>
        )}
      </div>
      <div className="relative flex inline gap-2 ml-2 mt-2">
<CiteInline
           deliberationId={deliberationId}
           argumentId={a.id}
           claimId={a.claimId ?? null}
           text={a.text}
           prefillUrl={prefillUrl}
           open={citeOpen}
           onClose={() => { setCiteOpen(false); setPrefillUrl(undefined); }}
           onPromoteWithEvidence={(url) => onPromoteWithEvidence(url)}
         />
         </div>
         </div>
    </div>
    {/* </div> */}
    </div>
  );
}
// ------ DialogicalRow (upgrade) -------------------------------------------
// import useSWR from 'swr';
// import { InlineMoveForm } from '@/components/dialogue/InlineMoveForm';
// import { useLudicsPhase } from '@/components/dialogue/useLudicsPhase';
// import AnchorToMapButton from '@/components/map/AnchorToMapButton';
// import { LegalMoveChips } from '@/components/dialogue/LegalMoveChips';

// const fetcher = (u: string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

function HUDBadge({ ok, label }:{ ok:boolean; label:string }) {
  const cls = ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-white/70 text-slate-700';
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] ${cls}`}>{label}</span>;
}

function StatPill({ tone, children }:{ tone:'attack'|'surrender'|'neutral'; children:React.ReactNode }) {
  const cls =
    tone === 'attack'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'surrender'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-slate-200 bg-white/70 text-slate-700';
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] ${cls}`}>{children}</span>;
}


function DialogicalRow({
  a,
  deliberationId,
  onReplyTo,
  onOpenDispute,
  whyLocusPath,          // e.g. "0.3" if this row is about a specific WHY; optional
  onPosted,
}: {
  a: Arg;
  deliberationId: string;
  onReplyTo: (id: string) => void;
  onOpenDispute: (id: string, label: string) => void;
  whyLocusPath?: string;
  onPosted?: () => void;
}) {
  const created = new Date(a.createdAt).toLocaleString();

  // Derive the “commit owner” from the panel’s phase (matches LudicsPanel broadcast)
  const phase = useLudicsPhase();     // 'neutral' | 'focus-P' | 'focus-O'
  const commitOwner = phase === 'focus-O' ? 'Opponent' : 'Proponent';

  // Target resolution: claim rows post to claim; otherwise to argument
  const targetType: 'argument' | 'claim' = a.claimId ? 'claim' : 'argument';
  const targetId = a.claimId ?? a.id;

  // Prefer provided locusPath; default to root ("0")
  const locusPath = whyLocusPath ?? '0';

  // --- Row Move HUD: summarize legal options now (defensive to endpoint shape)
  const lmKey = `/api/dialogue/legal-moves?deliberationId=${encodeURIComponent(deliberationId)}&targetType=${targetType}&targetId=${encodeURIComponent(targetId)}&locusPath=${encodeURIComponent(locusPath)}`;
  // const { data: legal } = useSWR<{ items?: Array<{kind:string;disabled?:boolean;force?:'ATTACK'|'SURRENDER'|'NEUTRAL'}> }>(lmKey, fetcher);

  // const attackCount =
  //   (legal?.items || []).filter(m => (m.force ?? (m.kind === 'WHY' || m.kind === 'GROUNDS' ? 'ATTACK' : 'NEUTRAL')) === 'ATTACK' && !m.disabled).length;
  // const surrenderCount =
  //   (legal?.items || []).filter(m => (m.force ?? (m.kind === 'CONCEDE' || m.kind === 'RETRACT' || m.kind === 'CLOSE' ? 'SURRENDER' : 'NEUTRAL')) === 'SURRENDER' && !m.disabled).length;
  // const canClose = (legal?.items || []).some(m => m.kind === 'CLOSE' && !m.disabled);

const { data: legal } = useSWR<{ moves: Array<{ kind:string; disabled?:boolean; force?:'ATTACK'|'SURRENDER'|'NEUTRAL' }> }>(lmKey, fetcher);

const attackCount = (legal?.moves || []).filter(m => (m.force ?? (m.kind === 'WHY' || m.kind === 'GROUNDS' ? 'ATTACK' : 'NEUTRAL')) === 'ATTACK' && !m.disabled).length;
const surrenderCount = (legal?.moves || []).filter(m => (m.force ?? (m.kind === 'CONCEDE' || m.kind === 'RETRACT' || m.kind === 'CLOSE' ? 'SURRENDER' : 'NEUTRAL')) === 'SURRENDER' && !m.disabled).length;
const canClose = (legal?.moves || []).some(m => m.kind === 'CLOSE' && !m.disabled);


  // CQ presence hint (claims only)
  const { data: openCqs } = useSWR<{ ok:boolean; keys:string[] }>(
    targetType === 'claim'
      ? `/api/dialogue/open-cqs?deliberationId=${encodeURIComponent(deliberationId)}&targetId=${encodeURIComponent(targetId)}`
      : null,
    fetcher
  );
  const openCQCount = Array.isArray(openCqs?.keys) ? openCqs!.keys.length : 0;

  // Row text (clamped, consistent with ArgumentsList's helper)
  function Clamped({ text, lines = 3 }:{ text:string; lines?:number }) {
    const [open, setOpen] = React.useState(false);
    return open ? (
      <div className="text-sm whitespace-pre-wrap">{text}</div>
    ) : (
      <div className="relative">
        <div className={`text-sm whitespace-pre-wrap line-clamp-${lines}`}>{text}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/90 to-transparent" />
        <button className="btnv2--ghost py-0 px-2 rounded btnv2--sm absolute right-0 bottom-0 translate-y-1 translate-x-2"
                onClick={()=>setOpen(true)}>More</button>
      </div>
    );
  }

  async function post(kind:MoveKind, payload:any = {}) {
    await fetch('/api/dialogue/move', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({
        deliberationId,
        targetType, targetId, kind,
        payload: { locusPath, ...payload },
        autoCompile:true, autoStep:true, phase:'neutral',
      }),
    }).catch(()=>null);
    window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
    onPosted?.();
  }

  return (
    <div id={`arg-${a.id}`} className="p-3 border-b">
      {/* Header strip */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] text-neutral-500">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5">{created}</span>
          <span className="ml-2 inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5">
            Locus <b className="ml-1">{locusPath}</b>
          </span>
          <span className="ml-2 inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5">
            Commit owner: <b className="ml-1">{commitOwner}</b>
          </span>
          {targetType === 'claim' && (
            <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"
                  title="Open critical questions for this claim">
              CQs open: {openCQCount}
            </span>
          )}
        </div>
        <AnchorToMapButton argumentId={a.id} />
      </div>

      {/* Body */}
      <div className="w-fit h-fit px-2 py-1 bg-slate-50 border rounded">
        <ClampReveal id={a.id} text={a.text} lines={4} />

      </div>

      {/* Row Move HUD */}
      <div className="mt-2 flex items-center gap-2">
        <StatPill tone="attack">ATTACKS: {attackCount}</StatPill>
        <StatPill tone="surrender">CONCEDES: {surrenderCount}</StatPill>
        <HUDBadge ok={!!canClose} label={canClose ? 'Closable (†)' : 'Not closable'} />
      </div>

      {/* Legal move chips (uses your existing component)
      <div className="mt-2">
        <LegalMoveChips
          deliberationId={deliberationId}
          targetType={targetType}
          targetId={targetId}
          locusPath={locusPath}
          commitOwner={commitOwner}
          onPosted={onPosted}
        />
      </div>

      {/* Inline WHY & GROUNDS */}
      {/* <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
        <InlineMoveForm
          placeholder="Challenge this: WHY …"
          onSubmit={async (note) => {
            await post('WHY', { note });
          }}
        />
        <InlineMoveForm
          placeholder="Provide grounds…"
          onSubmit={async (brief) => {
            await post('GROUNDS', { brief });
          }}
        />
      </div> */}


{/* Replace chips + inline forms */}
<div className="mt-2">
  <LegalMoveToolbar
    deliberationId={deliberationId}
    targetType={targetType}
    targetId={targetId}
    locusPath={locusPath}
    commitOwner={commitOwner}
    onPosted={onPosted}
  />
</div>

    

      {/* Footer – keep only neutral row actions */}
<div className="mt-2 flex items-center gap-2">
  <button className="px-2 py-1 btnv2--ghost rounded text-xs" onClick={() => onReplyTo(a.id)}>Reply</button>
  <button className="px-2 py-1 btnv2--ghost rounded text-xs" onClick={() => onOpenDispute(a.id, targetType === "claim" ? "Meaning / Scope (claim)" : "Meaning / Scope")}>Open issue</button>
  {/* leave Discuss in Ludics / Cite in your ArgRow variant */}
</div>
    </div>
  );
}

 
//   <div className="mt-2 flex items-center gap-2">
//         <button
//           className="px-2 py-1 btnv2--ghost rounded text-xs"
//           onClick={() => onReplyTo(a.id)} // <-- send preview

          
//         >
//           Reply
//         </button>
//         <button
//           className="px-2 py-1 btnv2--ghost rounded text-xs"
//           onClick={() => onOpenDispute(a.id, targetType === 'claim' ? 'Meaning / Scope (claim)' : 'Meaning / Scope')}>
//           Open issue
//         </button>
//         {/* Quick surrender/close helpers */}
//         <button
//           className="px-2 py-1 btnv2--ghost rounded text-xs"
//           onClick={() => post('CONCEDE', { as:'CONCEDE' })}
//           title="Concede here"
//         >
//           Concede
//         </button>
//         <button
//           className="px-2 py-1 btnv2--ghost rounded text-xs"
//           onClick={() => post('RETRACT')}
//           title="Retract here"
//         >
//           Retract
//         </button>
//         <button
//           className="px-2 py-1 border rounded text-xs"
//           disabled={!canClose}
//           onClick={() => canClose && post('CLOSE')}
//           title="Close this locus (†)"
//         >
//           Close (†)
//         </button>
//       </div>

function DiscussInLudicsButton({
  deliberationId, argumentId, setTarget
}: { deliberationId: string; argumentId: string; setTarget: (t:{type:'argument'|'claim',id:string})=>void }) {
  const [busy, setBusy] = React.useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      // 1) bridge monological → dialogue (safe if already bridged)
      await fetch('/api/monological/bridge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ argumentId }),
      }).catch(()=>{});

      // 2) compile/step
      await fetch('/api/ludics/compile-step', {
        method: 'POST',  
        credentials: 'include',

        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliberationId, phase: 'neutral' }),
      }).catch(()=>{});

      // 3) focus the panel + set target
      setTarget({ type: 'argument', id: argumentId });
      window.dispatchEvent(new CustomEvent('dialogue:moves:refresh', { detail: { deliberationId } } as any));
      window.dispatchEvent(new CustomEvent('ludics:open',           { detail: { deliberationId } } as any));
      window.dispatchEvent(new CustomEvent('ludics:focus',          { detail: { phase: 'focus-P' } } as any));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="px-2 py-1 rounded text-xs btnv2--ghost"
      onClick={go}
      disabled={busy}
      aria-busy={busy}
      title="Bridge this argument into the dialogue and open the negotiation panel"
    >
      {busy ? 'Opening…' : 'Discuss in Ludics'}
    </button>
  );
}
function scrollComposerIntoView() {
  // Let any listeners open/reveal the composer first
  window.dispatchEvent(new CustomEvent('mesh:composer:focus'));
  // DOM fallback after a short delay
  setTimeout(() => {
    const el =
      document.getElementById('deliberation-composer') ||
      document.querySelector('[data-role="deliberation-composer"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const input = el.querySelector('textarea, [contenteditable="true"], input[type="text"]') as HTMLElement | null;
      if (input) input.focus();
    }
  }, 60);
}




function CiteInline({
  deliberationId,
  argumentId,
  claimId,
  text,
  prefillUrl,
  open: forcedOpen,
  onClose,
  onPromoteWithEvidence,
}: {
  deliberationId: string;
  argumentId: string;
  claimId?: string | null;
  text: string;
  prefillUrl?: string;
  open?: boolean;
  onClose?: () => void;
  onPromoteWithEvidence?: (url: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [initialUrl, setInitialUrl] = React.useState<string | undefined>(prefillUrl);

  // respect forcedOpen (controlled opener from outside)
  React.useEffect(() => {
    if (forcedOpen !== undefined) setOpen(forcedOpen);
  }, [forcedOpen]);

  // detect URLs from the row text
  const urls = React.useMemo(() => {
    const found = (text.match(/\bhttps?:\/\/[^\s)]+/gi) ?? []).map((u) =>
      u.replace(/[),.;]+$/, "")
    );
    return Array.from(new Set(found));
  }, [text]);

  // chosen default url: prop prefill > first detected > undefined
  React.useEffect(() => {
    if (!initialUrl) {
      setInitialUrl(prefillUrl ?? urls[0] ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillUrl, urls]);

  async function handleCiteAndPromote(url: string) {
    if (!onPromoteWithEvidence) return;
    setBusy(true);
    try {
      await onPromoteWithEvidence(url);
      setOpen(false);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  // open modal, optionally with a specific url prefilled
  function openModal(url?: string) {
    if (url) setInitialUrl(url);
    setOpen(true);
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button
          className="px-2 py-1 btnv2--ghost rounded text-xs"
          onClick={() => openModal()}
          aria-expanded={open}
        >
          Cite
        </button>

        {urls.length === 1 && (
          <>
            <button
              className="px-2 py-1 btnv2--ghost rounded text-xs"
              disabled={busy}
              title={urls[0]}
              onClick={() => openModal(urls[0])}
            >
              Cite detected link
            </button>
            {!claimId && onPromoteWithEvidence && (
              <button
                className="px-2 py-1 rounded text-xs border"
                disabled={busy}
                onClick={() => handleCiteAndPromote(urls[0])}
                title="Promote to claim and attach this link as evidence"
              >
                Cite & Promote
              </button>
            )}
          </>
        )}

        {urls.length > 1 && (
          <details className="relative">
            <summary className="list-none px-2 py-1 btnv2--ghost rounded text-xs cursor-pointer">
              Cite detected links ▾
            </summary>
            <div className="absolute z-20 mt-1 rounded border bg-white shadow p-2 min-w-[240px]">
              {urls.map((u) => (
                <div
                  key={u}
                  className="flex items-center justify-between gap-2 py-0.5"
                >
                  <button
                    className="text-[11px] underline"
                    onClick={() => openModal(u)}
                    title={u}
                  >
                    {new URL(u).hostname}
                  </button>
                  {!claimId && onPromoteWithEvidence && (
                    <button
                      className="text-[11px] border rounded px-1"
                      disabled={busy}
                      onClick={() => handleCiteAndPromote(u)}
                      title="Promote & attach"
                    >
                      Cite & Promote
                    </button>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Modal picker */}
      <CitePickerModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) onClose?.();
        }}
        targetType={claimId ? "claim" : "argument"}
        targetId={claimId ?? argumentId}    
        title="Attach citation"
        initialUrl={initialUrl}
        // you can pass initialQuote/Locator here if you have them
        onDone={() => {
          setOpen(false);
          onClose?.();
        }}
      />
    </div>
  );
}


 function DelibMixBadge({ deliberationId }:{ deliberationId:string }) {
   const { data } = useSWR(
     `/api/monological/telemetry?deliberationId=${encodeURIComponent(deliberationId)}`,
     fetcher, { revalidateOnFocus:false }
   );
   if (!data?.totals) return null;
   const t = data.totals, sat = data.saturation?.likely;
   return (
     <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border ${sat ? 'border-amber-300 bg-amber-50 text-amber-700' : 'bg-white/70'}`}
       title={sat ? 'Qualifiers high & rebuttals low — consider inviting counter-cases' : 'Deliberation‑level mix'}>
       Delib mix: G{t.grounds} · Q{t.qualifiers} · R{t.rebuttals}{sat ? ' · likely saturation' : ''}
     </span>
   );
 }