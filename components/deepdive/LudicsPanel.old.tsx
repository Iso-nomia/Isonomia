"use client";

import * as React from "react";
import useSWR from "swr";
import { DefenseTree } from "@/packages/ludics-react/DefenseTree";
import { ActInspector } from "@/packages/ludics-react/ActInspector";
import { narrateTrace } from "@/components/dialogue/narrateTrace";
import type { StepResult } from "@/packages/ludics-core/types";
import { InsightsBadge, PolarityBadge } from "@/components/ludics/InsightsBadges";
import { InsightsTooltip } from "@/components/ludics/InsightsTooltip";
import type { LudicsInsights } from "@/lib/ludics/computeInsights";
import { Badge } from "@/components/ui/badge";
// Phase 2 extracted components
import { LudicsTraceViewer } from "@/components/ludics/LudicsTraceViewer";
import { LudicsTreePanel } from "@/components/ludics/LudicsTreePanel";
import { LudicsCommitmentsView } from "@/components/ludics/LudicsCommitmentsView";
import { LudicsActionsToolbar } from "@/components/ludics/LudicsActionsToolbar";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

// Helper for converting StepResult to TraceLike format
function asTraceLike(t?: StepResult | null) {
  if (!t) return null;
  return {
    steps: (t.pairs ?? [])
      .map((p: any) => {
        if (typeof p.posActId === "string" && typeof p.negActId === "string") {
          return {
            posActId: p.posActId,
            negActId: p.negActId,
            locusPath: p.locusPath ?? "",
            ts: p.ts ?? 0,
          };
        }
        return null;
      })
      .filter((x: any): x is NonNullable<typeof x> => x !== null),
    status: t.status === "STUCK" ? ("ONGOING" as const) : t.status,
    decisiveIndices: t.decisiveIndices,
  };
}

// Micro toast notification hook
function useMicroToast() {
  const [msg, setMsg] = React.useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const show = React.useCallback(
    (text: string, kind: "ok" | "err" = "ok", ms = 1600) => {
      setMsg({ kind, text });
      const id = setTimeout(() => setMsg(null), ms);
      return () => clearTimeout(id);
    },
    []
  );
  const node = msg ? (
    <div
      aria-live="polite"
      className={[
        "fixed bottom-4 right-4 z-50 rounded-md border px-3 py-2 text-xs shadow",
        "backdrop-blur bg-white/90",
        msg.kind === "ok"
          ? "border-emerald-200 text-emerald-700"
          : "border-rose-200 text-rose-700",
      ].join(" ")}
    >
      {msg.text}
    </div>
  ) : null;
  return { show, node };
}

export default function LudicsPanel({
  deliberationId,
  proDesignId,
  oppDesignId,
}: {
  deliberationId: string;
  proDesignId: string;
  oppDesignId: string;
}) {
  // Designs SWR
  const {
    data: designsData,
    mutate: mutateDesigns,
    error: designsError,
    isLoading: isDesignsLoading,
  } = useSWR(
    `/api/ludics/designs?deliberationId=${encodeURIComponent(deliberationId)}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const designs = designsData?.designs ?? [];
  const pro =
    designs.find((d: any) => d.participantId === "Proponent") ?? designs[0];
  const opp =
    designs.find((d: any) => d.participantId === "Opponent") ??
    designs[1] ??
    designs[0];

  // Fetch Ludics insights (Phase 1: Week 2)
  const { data: insightsData, isLoading: insightsLoading } = useSWR<{
    ok: boolean;
    insights: LudicsInsights | null;
  }>(
    `/api/ludics/insights?deliberationId=${deliberationId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 } // Cache for 1 min client-side
  );

  // Panel local UI state
  const [trace, setTrace] = React.useState<StepResult | null>(null);
  const [badges, setBadges] = React.useState<Record<number, string>>({});
  const [stable, setStable] = React.useState<number | null>(null);
  const [orthogonal, setOrthogonal] = React.useState<boolean | null>(null);
  const [focusIdx, setFocusIdx] = React.useState<number | null>(null);
  const [showGuide, setShowGuide] = React.useState(false);
  const [phase, setPhase] = React.useState<"neutral" | "focus-P" | "focus-O">(
    "neutral"
  );
  const [viewMode, setViewMode] = React.useState<"unified" | "split">(
    "unified"
  );
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitPath, setCommitPath] = React.useState<string | null>(null);

  const [showAttach, setShowAttach] = React.useState(false);
  const [attachLoading, setAttachLoading] = React.useState(false);
  const [attachPick, setAttachPick] = React.useState(""); // selected workId
  const [attachCandidates, setAttachCandidates] = React.useState<
    { id: string; title: string; theoryType: "IH" | "TC" | "DN" | "OP" }[]
  >([]);

  // When the attach section opens, list IH/TC works in this deliberation

  // When the attach section opens, list IH/TC works in this deliberation
  React.useEffect(() => {
    if (!showAttach) return;
    let cancelled = false;
    (async () => {
      try {
        setAttachLoading(true);
        const r = await fetch(
          `/api/works?deliberationId=${encodeURIComponent(deliberationId)}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        if (cancelled) return;
        setAttachCandidates(
          (j.works ?? []).filter(
            (w: any) => w.theoryType === "IH" || w.theoryType === "TC"
          )
        );
      } finally {
        if (!cancelled) setAttachLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAttach, deliberationId]);

  const { target } = useDialogueTarget();
  const targetIdFromContext = target?.id ?? null;
  const targetTypeFromContext = target?.type ?? "claim"; // sensible default

  const commitAtPath = React.useCallback((path: string) => {
    setCommitPath(path);
    setCommitOpen(true);
  }, []);

  // Broadcast phase so other components (e.g., row chips) can derive commitOwner
  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("ludics:phase", { detail: { phase } })
    );
  }, [phase]);

  // Throttled compile-step control
  const compRef = React.useRef(false);
  const lastCompileAt = React.useRef(0);
  const [busy, setBusy] = React.useState<
    false | "compile" | "step" | "nli" | "orth" | "append"
  >(false);
  const toast = useMicroToast();

  // Map acts by id from current designs (for NLI/Inspector, heatmap)
  const byAct = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const d of designs) for (const a of d.acts ?? []) map.set(a.id, a);
    return map;
  }, [designs]);

  // ------------------------------------------------------------------
  // Orthogonal SWR (trace   acts for narration & stable heatmap)
  const { data: orthoData, mutate: refreshOrth } = useSWR(
    deliberationId
      ? `/api/ludics/orthogonal?dialogueId=${encodeURIComponent(
          deliberationId
        )}&phase=neutral`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  React.useEffect(() => {
    const h = () => refreshOrth();
    window.addEventListener("dialogue:moves:refresh", h as any);
    return () => window.removeEventListener("dialogue:moves:refresh", h as any);
  }, [refreshOrth]);

  // keep local trace in sync with ortho trace
  React.useEffect(() => {
    const t = orthoData?.trace;
    if (t) {
      setTrace({
        pairs: t.pairs ?? [],
        status: t.status,
        endedAtDaimonForParticipantId: t.endedAtDaimonForParticipantId,
        endorsement: t.endorsement,
        decisiveIndices: t.decisiveIndices,
        usedAdditive: t.usedAdditive,
      });
    }
  }, [orthoData]);

  // 1) step index by act id (for tiny ① ② superscripts)
  const stepIndexByActId = React.useMemo(() => {
    const m: Record<string, number> = {};
    (trace?.pairs ?? []).forEach((p, i) => {
      // if (!p.posActId && !p.negActId) return;
      // if (m[p.posActId || ''] && m[p.negActId || '']) return; // already indexed
      if (p.posActId !== undefined) m[p.posActId] = i + 1;
      if (p.negActId !== undefined) m[p.negActId] = i + 1;
    });
    return m;
  }, [trace]);

  // 2) locus heatmap (frequency; bump decisive hits)
  const heatmap = React.useMemo(() => {
    const hm: Record<string, number> = {};
    const t = orthoData?.trace;
    const acts = (orthoData?.acts ?? {}) as Record<
      string,
      { locusPath?: string }
    >;
    if (!t) return hm;
    (t.pairs ?? []).forEach((p) => {
      const path = acts[p.posActId]?.locusPath ?? acts[p.negActId]?.locusPath;
      if (!path) return;
      hm[path] = (hm[path] ?? 0) + 1;
    });
    (t.decisiveIndices ?? []).forEach((i) => {
      const p = t.pairs?.[i];
      if (!p) return;
      const path = acts[p.posActId]?.locusPath ?? acts[p.negActId]?.locusPath;
      if (!path) return;
      hm[path] = (hm[path] ?? 0) + 2; // extra weight for decisive
    });
    return hm;
  }, [orthoData]);

  // 3) focused locus path (keeps narration ↔ tree synced)
  const focusPath = React.useMemo(() => {
    if (focusIdx == null || !trace) return null;
    const p = trace.pairs[focusIdx];
    const pos = byAct.get(p.posActId ?? "");
    const neg = byAct.get(p.negActId ?? "");
    return pos?.locus?.path ?? neg?.locus?.path ?? null;
  }, [focusIdx, trace, byAct]);

  // Handle "Focus" click from the tree toolbar
  const onFocusPathChange = React.useCallback(
    (path: string) => {
      const idx = (trace?.pairs ?? []).findIndex(
        (p) =>
          String(byAct.get(p.posActId)?.locus?.path) === path ||
          String(byAct.get(p.negActId)?.locus?.path) === path
      );
      if (idx >= 0) setFocusIdx(idx);
    },
    [trace, byAct]
  );
const suggestClose = React.useCallback((path: string) => {
  const t = orthoData?.trace;
  if (!t) return false;
  const last = t.pairs?.[t.pairs.length - 1]?.locusPath;
  return last === path && (t.status === 'CONVERGENT' || t.status === 'STUCK');
}, [orthoData]);
  // Narration lines
  const actsForNarration = orthoData?.acts ?? {};
  const lines = orthoData?.trace
    ? narrateTrace(orthoData.trace, actsForNarration)
    : [];

  /* ------------------------------- Actions ------------------------------- */
  const compileStep = React.useCallback(
    async (p: "neutral" | "focus-P" | "focus-O" = phase) => {
      const now = Date.now();
      if (now - lastCompileAt.current < 1200) return;
      if (compRef.current) return;
      compRef.current = true;
      setBusy("compile");
      try {
        const r = await fetch("/api/ludics/compile-step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deliberationId, phase: p }),
        })
          .then((r) => r.json())
          .catch(() => null);

        if (r?.trace) {
          setTrace({
            steps: r.trace.pairs ?? [],
            status: r.trace.status,
            endedAtDaimonForParticipantId:
              r.trace.endedAtDaimonForParticipantId,
            endorsement: r.trace.endorsement,
            decisiveIndices: r.trace.decisiveIndices,
            usedAdditive: r.trace.usedAdditive,
          });
        }
      } finally {
        compRef.current = false;
        setBusy(false);
        lastCompileAt.current = Date.now();
        mutateDesigns();
      }
    },
    [deliberationId, phase, mutateDesigns]
  );
  const compileStepRef = React.useRef(compileStep);
  React.useEffect(() => {
    compileStepRef.current = compileStep;
  }, [compileStep]);

  React.useEffect(() => {
    function onRefresh(e: any) {
      const id = e?.detail?.deliberationId;
      if (id && id !== deliberationId) return;
      compileStepRef.current("neutral");
    }
    window.addEventListener("dialogue:moves:refresh", onRefresh);
    return () =>
      window.removeEventListener("dialogue:moves:refresh", onRefresh);
  }, [deliberationId]);

  React.useEffect(() => {
    compileStepRef.current("neutral");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliberationId]);

  const step = React.useCallback(async () => {
    if (!designs?.length) return;
    setBusy("step");
    try {
      const pos =
        designs.find((d: any) => d.participantId === "Proponent") ?? designs[0];
      const neg =
        designs.find((d: any) => d.participantId === "Opponent") ??
        designs[1] ??
        designs[0];
      const res = await fetch("/api/ludics/step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dialogueId: deliberationId,
          posDesignId: pos.id,
          negDesignId: neg.id,
        }),
      }).then((r) => r.json());
      setTrace({
        steps: res.pairs || [],
        status: res.status,
        endedAtDaimonForParticipantId: res.endedAtDaimonForParticipantId,
        endorsement: res.endorsement,
        decisiveIndices: res.decisiveIndices,
        usedAdditive: res.usedAdditive,
      });
      toast.show("Stepped", "ok");
    } finally {
      setBusy(false);
    }
  }, [deliberationId, designs, toast]);

  const appendDaimonToNext = React.useCallback(async () => {
    if (!designs?.length) return;
    setBusy("append");
    try {
      const [, B] = designs;
      await fetch("/api/ludics/acts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          designId: B.id,
          enforceAlternation: false,
          acts: [{ kind: "DAIMON" }],
        }),
      });
      await step();
    } finally {
      setBusy(false);
    }
  }, [designs, step]);

  const pickAdditive = React.useCallback(
    async (parentPath: string, child: string) => {
      if (!designs?.length) return;
      const pos =
        designs.find((d: any) => d.participantId === "Proponent") ?? designs[0];
      const neg =
        designs.find((d: any) => d.participantId === "Opponent") ??
        designs[1] ??
        designs[0];
      try {
        const r = await fetch("/api/ludics/additive/pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dialogueId: deliberationId,
            posDesignId: pos.id,
            negDesignId: neg.id,
            parentPath,
            childSuffix: child,
          }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Pick failed");
        toast.show(`Choice locked for ${parentPath} → ${child}`, "ok");
        await compileStep("focus-P");
      } catch (e: any) {
        toast.show(`Pick failed: ${e?.message ?? "error"}`, "err");
      }
    },
    [designs, deliberationId, compileStep, toast]
  );

  const checkOrthogonal = React.useCallback(async () => {
    if (!designs?.length) return;
    setBusy("orth");
    try {
      const [A, B] = designs;
      const r = await fetch(
        `/api/ludics/orthogonal?dialogueId=${encodeURIComponent(
          deliberationId
        )}&posDesignId=${A.id}&negDesignId=${B.id}`
      ).then((r) => r.json());
      setOrthogonal(r?.orthogonal ?? null);
      if (r?.trace) {
        setTrace({
          steps: r.trace.pairs ?? [],
          status: r.trace.status,
          endedAtDaimonForParticipantId: r.trace.endedAtDaimonForParticipantId,
          endorsement: r.trace.endorsement,
          decisiveIndices: r.trace.decisiveIndices,
          usedAdditive: r.trace.usedAdditive,
        });
      }
      toast.show(
        r?.orthogonal ? "Orthogonal ✓" : "Not orthogonal",
        r?.orthogonal ? "ok" : "err"
      );
      refreshOrth();
    } finally {
      setBusy(false);
    }
  }, [designs, deliberationId, toast, refreshOrth]);

  const analyzeNLI = React.useCallback(async () => {
    if (!trace || !designs?.length) return;
    setBusy("nli");
    try {
      const pairs = (trace.steps ?? []).map((p) => ({
        premise: String(byAct.get(p.posActId)?.expression ?? ""),
        hypothesis: String(byAct.get(p.negActId)?.expression ?? ""),
      }));
      const res = await fetch("/api/nli/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: pairs }),
      }).then((r) => r.json());

      const TAU = Number(process.env.NEXT_PUBLIC_CQ_NLI_THRESHOLD ?? "0.72");
      const b: Record<number, string> = {};
      res?.results?.forEach((r: any, i: number) => {
        if (r?.relation === "contradicts" && (r.score ?? 0) >= TAU)
          b[i] = "NLI⊥";
      });
      setBadges(b);
    } finally {
      setBusy(false);
    }
  }, [trace, designs, byAct]);

  const checkStable = React.useCallback(async () => {
    const res = await fetch(
      `/api/af/stable?deliberationId=${encodeURIComponent(deliberationId)}`
    ).then((r) => r.json());
    setStable(res.count ?? 0);
  }, [deliberationId]);

  // Build prefix path up to index i from the trace, as (pol,locus) acts:
  const prefixActs = React.useCallback(
    (i: number): VeAct[] => {
      const out: VeAct[] = [];
      for (let k = 0; k <= i; k++) {
        const p = trace?.pairs?.[k];
        if (!p) break;
        const P = byAct.get(p.posActId ?? "");
        const O = byAct.get(p.negActId ?? "");
        if (P?.locus?.path)
          out.push({ pol: "pos", locus: String(P.locus.path) });
        if (O?.locus?.path)
          out.push({ pol: "neg", locus: String(O.locus.path) });
      }
      return out;
    },
    [trace, byAct]
  );

  // ⊙ failures per pair index (i): dual(prefix) is *not* a path
  const revFail = React.useMemo(() => {
    const m: Record<number, true> = {};
    const n = trace?.pairs?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const acts = prefixActs(i);
      const dual = dualPath(acts);
      const ok = isPath(dual).ok;
      if (!ok) m[i] = true;
    }
    return m;
  }, [trace, prefixActs]);

  const onConcede = React.useCallback(
    async (locus: string, proposition: string) => {
      await fetch("/api/ludics/concession", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dialogueId: deliberationId,
          concedingParticipantId: "Opponent",
          anchorLocus: locus,
          proposition: { text: proposition },
        }),
      });
      await mutateDesigns();
      await step();
    },
    [deliberationId, mutateDesigns, step]
  );

  const onForceConcession = React.useCallback(
    async (locus: string, text: string) => {
      if (!designs?.length) return;
      const [, B] = designs;
      await fetch("/api/ludics/judge/force", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dialogueId: deliberationId,
          action: "FORCE_CONCESSION",
          target: { designId: B.id, locusPath: locus },
          data: { text },
        }),
      });
      await mutateDesigns();
      await step();
    },
    [designs, deliberationId, mutateDesigns, step]
  );

  const onCloseBranch = React.useCallback(
    async (locus: string) => {
      if (!designs?.length) return;
      const [, B] = designs;
      await fetch("/api/ludics/judge/force", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dialogueId: deliberationId,
          action: "CLOSE_BRANCH",
          target: { designId: B.id, locusPath: locus },
        }),
      });
      await mutateDesigns();
      await step();
    },
    [designs, deliberationId, mutateDesigns, step]
  );

  //    const commitAtPath = React.useCallback(async (path: string) => {
  //    const label = window.prompt('New commitment label (fact):', '');
  //    if (!label) return;
  //    try {
  //      await fetch('/api/commitments/apply', {
  //        method:'POST', headers:{'content-type':'application/json'},
  //        body: JSON.stringify({
  //          dialogueId: deliberationId,
  //          ownerId: 'Proponent',               // or current side
  //          autoPersistDerived: false,
  //          ops: { add: [{ label, basePolarity: 'pos', baseLocusPath: path, entitled: true }] }
  //        })
  //      });
  //      window.dispatchEvent(new CustomEvent('dialogue:cs:refresh', { detail: { dialogueId: deliberationId, ownerId: 'Proponent' }}));
  //      toast.show(`Committed “${label}” @ ${path}`, 'ok');
  //    } catch (e:any) {
  //      toast.show('Commit failed', 'err');
  //    }
  // }, [deliberationId, toast]);

  /* ------------------------- Sync + keyboard hooks ----------------------- */
  React.useEffect(() => {
    const onFocus = async (e: any) => {
      const { phase } = e?.detail || {};
      await compileStep(phase ?? "focus-P");
    };
    window.addEventListener("ludics:focus", onFocus as any);
    return () => window.removeEventListener("ludics:focus", onFocus as any);
  }, [compileStep]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.key === "c") compileStep();
      else if (e.key === "s") step();
      else if (e.key === "o") checkOrthogonal();
      else if (e.key === "n") analyzeNLI();
      else if (e.key === "l") setShowGuide((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [compileStep, step, checkOrthogonal, analyzeNLI]);

  /* ------------------------------ Rendering ------------------------------ */
  const steps = trace?.pairs ?? [];
  const actsCount = designs.reduce(
    (acc: number, d: any) => acc + (d.acts?.length ?? 0),
    0
  );
  const traceLike = asTraceLike(trace) ?? {
    steps: [],
    status: "ONGOING" as const,
  };

  return (
    <div className="space-y-3 rounded-2xl  bg-slate-50/70 p-3 panel-edge backdrop-blur">
      {/* Ludics Insights Section (Phase 1: Week 2) */}
      {insightsData?.insights && (
        <div className="rounded-lg bg-white/80 border border-slate-200/80 p-3 space-y-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-slate-700">
              Interaction Metrics
            </h3>
            <div className="flex items-center gap-4">
              <InsightsTooltip insights={insightsData.insights}>
                <InsightsBadge
                  complexityScore={insightsData.insights.interactionComplexity}
                  size="sm"
                />
              </InsightsTooltip>
              <PolarityBadge
                positive={insightsData.insights.polarityDistribution.positive}
                negative={insightsData.insights.polarityDistribution.negative}
                neutral={insightsData.insights.polarityDistribution.neutral}
                size="sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.totalActs}</div>
              <div className="text-slate-600">Acts</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.totalLoci}</div>
              <div className="text-slate-600">Loci</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.maxDepth}</div>
              <div className="text-slate-600">Depth</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.branchFactor.toFixed(1)}</div>
              <div className="text-slate-600">Branches</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChipBar>
            <span>|D| {designs.length}</span>
            <span>|acts| {actsCount}</span>
            <span>|pairs| {steps.length}</span>
            {trace?.status && (
              <span
                className={[
                  "px-1.5 py-0.5 rounded border",
                  trace.status === "CONVERGENT"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : trace.status === "DIVERGENT"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-slate-50 border-slate-200 text-slate-700",
                ].join(" ")}
              >
                {trace.status === "CONVERGENT" ? "† CONVERGENT" : trace.status}
              </span>
            )}
            {typeof stable === "number" && <span>stable {stable}</span>}
            {orthogonal !== null && (
              <span
                className={[
                  "px-1.5 py-0.5 rounded border",
                  orthogonal
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700",
                ].join(" ")}
              >
                {orthogonal ? "orthogonal ✓" : "not orthogonal"}
              </span>
            )}
          </ChipBar>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Phase"
            value={phase}
            onChange={(v) => {
              setPhase(v);
              compileStep(v);
            }}
            options={[
              { value: "neutral", label: "Neutral" },
              { value: "focus-P", label: "Focus P" },
              { value: "focus-O", label: "Focus O" },
            ]}
          />
          <Segmented
            ariaLabel="Tree layout"
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { value: "unified", label: "Unified" },
              { value: "split", label: "Split" },
            ]}
          />

          <button
            className="btnv2"
            aria-label="Compile from moves"
            onClick={() => compileStep("neutral")}
            disabled={!!busy}
          >
            {busy === "compile" ? "Compiling…" : "Compile"}
          </button>
          <button
            className="btnv2"
            aria-label="Step"
            onClick={step}
            disabled={!!busy}
          >
            {busy === "step" ? "Stepping…" : "Step"}
          </button>
          <button
            className="btnv2"
            aria-label="Append daimon to next"
            onClick={appendDaimonToNext}
            disabled={!!busy}
          >
            {busy === "append" ? "Working…" : "Append †"}
          </button>
          <button
            className="btnv2"
            aria-label="Check orthogonality"
            onClick={checkOrthogonal}
            disabled={!!busy}
          >
            {busy === "orth" ? "Checking…" : "Orthogonality"}
          </button>
          <button
            className="btnv2"
            aria-label="Analyze NLI"
            onClick={analyzeNLI}
            disabled={!!busy}
          >
            {busy === "nli" ? "Analyzing…" : "NLI"}
          </button>
          <button
            className="btnv2 btnv2--ghost"
            aria-label="Trace Log"
            onClick={() => setShowGuide((v) => !v)}
          >
            {showGuide ? "Hide log" : "Trace log"}
          </button>
          <button
            className="btnv2 btnv2--ghost"
            aria-label="Stable ets"
            onClick={checkStable}
          >
            Stable sets
          </button>
          <button
            className="btnv2 btnv2--ghost"
            onClick={() => setShowAttach((v) => !v)}
            aria-expanded={showAttach}
          >
            {showAttach ? "Hide testers" : "Attach testers"}
          </button>
        </div>
      </div>

      {/* Ribbon */}
      <div className="rounded-md border border-slate-200 bg-white/60 p-2">
        {traceLike ? (
          <TraceRibbon
            steps={traceLike.steps}
            status={traceLike.status}
            badges={badges}
            decisiveIndices={trace?.decisiveIndices}
            revFailIndices={Object.keys(revFail).map(Number)}
          />
        ) : (
          <div className="text-xs text-neutral-500">No traversal yet.</div>
        )}
        {trace?.decisiveIndices?.length ? (
          <div className="mt-1 text-[11px] text-indigo-700">
            decisive: {trace.decisiveIndices.map((i) => i + 1).join(", ")}
          </div>
        ) : null}
        {/* commitment delta overlay */}
        <CommitmentDelta
          dialogueId={deliberationId}
          refreshKey={`${trace?.status}:${trace?.pairs?.length ?? 0}`}
        />
      </div>
      {showAttach && (
        <div className="mt-2 rounded border bg-white/60 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-600">Source Work:</span>
            <select
              className="border rounded px-2 py-1"
              value={attachPick}
              onChange={(e) => setAttachPick(e.target.value)}
            >
              <option value="">— Select IH/TC Work —</option>
              {attachCandidates.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} [{w.theoryType}]
                </option>
              ))}
            </select>

            <button
              className="px-2 py-1 border rounded bg-white"
              disabled={!attachPick || attachLoading || isDesignsLoading}
              onClick={async () => {
                try {
                  setAttachLoading(true);
                  // Get suggested testers from the selected Work
                  const j = await fetch(
                    `/api/works/${attachPick}/ludics-testers`,
                    { cache: "no-store" }
                  )
                    .then((r) => r.json())
                    .catch(() => null);

                  // Resolve designs (pos/neg) from SWR data you already loaded
                  const pos = pro?.id ?? designs[0]?.id;
                  const neg = opp?.id ?? designs[1]?.id ?? designs[0]?.id;
                  if (!pos || !neg) throw new Error("Missing designs");

                  // Attach testers by stepping with them
                  const r = await fetch("/api/ludics/step", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      dialogueId: deliberationId,
                      posDesignId: pos,
                      negDesignId: neg,
                      testers: j?.testers ?? [],
                      fuel: 2048,
                    }),
                  });

                  if (!r.ok) throw new Error(await r.text());
                  toast.show("Testers attached", "ok");

                  // Refresh panels that depend on the run/designs
                  await Promise.all([refreshOrth(), mutateDesigns()]);
                } catch (e: any) {
                  toast.show(`Attach failed: ${e?.message ?? "error"}`, "err");
                } finally {
                  setAttachLoading(false);
                }
              }}
            >
              {attachLoading ? "Attaching…" : "Attach"}
            </button>
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Tip: you can refine loci in Evaluation/Loci tools after attaching.
          </div>
        </div>
      )}

      {/* Legend + narrative */}
      {showGuide && (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="border rounded p-2 bg-slate-50">
            <div className="font-semibold text-sm mb-1">Legend</div>
            <ul className="list-disc ml-4 space-y-1 text-xs">
              <li>
                <b>P</b> / <b>O</b>: Proponent / Opponent
              </li>
              <li>
                <b>† Daimon</b>: branch ends (accept/fail)
              </li>
              <li>
                <b>⊕ Additive</b>: choice node
              </li>
              <li>
                <b>Locus</b> <code>0.1.2</code>: root → child 1 → child 2
              </li>
              <li>
                <b>Orthogonal</b>: no illegal reuse across designs
              </li>
            </ul>
          </div>

          <div className="border rounded p-2 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm mb-1">Narrated trace</div>
              <button
                className="text-[11px] underline decoration-dotted"
                onClick={() => {
                  if (!lines.length) return;
                  const txt = lines
                    .map((l, i) => `${i + 1}) ${l.text}`)
                    .join("\n");
                  navigator.clipboard?.writeText(txt).catch(() => {});
                }}
                title="Copy narrated trace"
              >
                Copy
              </button>
            </div>

            {!trace ? (
              <div className="text-xs text-neutral-500">
                No trace yet — post a WHY or GROUNDS.
              </div>
            ) : (
              <ol className="list-decimal ml-5 space-y-1 text-sm">
                {lines.map((ln, i) => (
                  <li key={i}>
                    <button
                      className={[
                        "text-left underline decoration-dotted",
                        focusIdx === i ? "text-sky-700" : "text-neutral-800",
                        ln.decisive ? "font-semibold" : "",
                      ].join(" ")}
                      onClick={() => setFocusIdx(i)}
                      title={ln.hover}
                    >
                      {i + 1}) {ln.text}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
      {/* Inspector */}
      {focusIdx !== null && trace && (
        <ActInspector
          pos={byAct.get(trace.pairs[focusIdx]?.posActId ?? "")}
          neg={byAct.get(trace.pairs[focusIdx]?.negActId ?? "")}
          onClose={() => setFocusIdx(null)}
        />
      )}
      {/* Trees */}
      <div className="grid gap-4">
        {viewMode === "unified" ? (
          <div className="border rounded-lg p-2 bg-white/60">
            <div className="text-xs mb-1 flex items-center gap-2">
              <b>Unified loci</b>
              <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                acts {actsCount}
              </span>
            </div>
            {/* <LociTree
              root={mergeDesignsToTree(designs)}
              usedAdditive={trace?.usedAdditive}
              onPickBranch={pickAdditive}
              focusPath={focusPath}
              onCommitHere={commitAtPath}
              onFocusPathChange={onFocusPathChange}
              defaultCollapsedDepth={1}
              showExpressions
              heatmap={heatmap}
              stepIndexByActId={stepIndexByActId}
              autoScrollOnFocus
              enableKeyboardNav
            /> */}
            <LociTreeWithControls
              dialogueId={deliberationId}
              posDesignId={proDesignId}
              negDesignId={oppDesignId}
              defaultMode="assoc"
              suggestCloseDaimonAt={suggestClose}
            />

            {commitOpen && commitPath && targetIdFromContext && (
              <NLCommitPopover
                open={commitOpen}
                onOpenChange={setCommitOpen}
                deliberationId={deliberationId}
                targetType={targetTypeFromContext}
                targetId={targetIdFromContext}
                locusPath={commitPath}
                defaultOwner="Proponent"
                onDone={() => {
                  /* refresh */
                }}
              />
            )}
          </div>
        ) : (
          // Split view: one per design (kept for debugging/teaching)
          <div className="grid md:grid-cols-2 gap-4">
            {isDesignsLoading && (
              <>
                <SkeletonCard lines={4} />
                <SkeletonCard lines={4} />
              </>
            )}
            {designsError && (
              <div className="col-span-2 text-xs text-rose-600 border rounded p-2">
                Failed to load designs.
              </div>
            )}
            {designs?.map((d: any) => (
              <div key={d.id} className="border rounded-lg p-2 bg-white/60">
                <div className="text-xs mb-1 flex items-center gap-2">
                  <b>{d.participantId}</b> · {d.id.slice(0, 6)}
                  {(() => {
                    const first = (d.acts ?? [])[0];
                    const start =
                      first?.polarity === "O"
                        ? "Start: Negative"
                        : first?.polarity === "P"
                        ? "Start: Positive"
                        : "Start: —";
                    return (
                      <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                        {start}
                      </span>
                    );
                  })()}
                  <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                    acts {d.acts?.length ?? 0}
                  </span>
                </div>
                <LociTree
                  root={shapeToTree(d)}
                  onPickBranch={pickAdditive}
                  usedAdditive={trace?.usedAdditive}
                  focusPath={focusPath}
                  onFocusPathChange={onFocusPathChange}
                  defaultCollapsedDepth={1}
                  showExpressions
                  heatmap={heatmap}
                  stepIndexByActId={stepIndexByActId}
                  autoScrollOnFocus
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commitments */}
      <div className="grid md:grid-cols-2 gap-4">
        <CommitmentsPanel
          dialogueId={deliberationId}
          ownerId="Proponent"
          onChanged={() => {}}
        />
        <CommitmentsPanel
          dialogueId={deliberationId}
          ownerId="Opponent"
          onChanged={() => {}}
        />
      </div>

      {/* Defense tree */}
      <DefenseTree
        designs={designs}
        trace={traceLike}
        decisiveWindow={3}
        highlightIndices={trace?.decisiveIndices}
      />

      {/* Judge tools */}
      <JudgeConsole
        onForceConcession={onForceConcession}
        onCloseBranch={onCloseBranch}
        onConcede={onConcede}
        onStepNow={step}
        locusSuggestions={["0", "0.1", "0.2"]}
        defaultTarget="Opponent"
      />
      {toast.node}
    </div>
  );
}

/* ------------------------------ Utilities ------------------------------- */
function shapeToTree(d: any) {
  const nodes = new Map<string, any>();
  const ensure = (path: string) => {
    if (!nodes.has(path))
      nodes.set(path, { id: path, path, acts: [], children: [] });
    return nodes.get(path);
  };

  for (const a of d.acts ?? []) {
    const p = a?.locus?.path ?? "0";
    ensure(p).acts.push({
      id: a.id,
      polarity: a.polarity,
      expression: a.expression,
      isAdditive: a.isAdditive || a.additive,
    });
    const parts = p.split(".");
    for (let i = 1; i < parts.length; i++) ensure(parts.slice(0, i).join("."));
  }

  const all = Array.from(nodes.values());
  const byPath = Object.fromEntries(all.map((n: any) => [n.path, n]));
  for (const n of all) {
    const parent = n.path.includes(".")
      ? n.path.split(".").slice(0, -1).join(".")
      : null;
    if (parent && byPath[parent]) byPath[parent].children.push(n);
  }
  return (
    byPath["0"] || all[0] || { id: "0", path: "0", acts: [], children: [] }
  );
}
