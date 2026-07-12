/**
 * FrontierLane — Track AI-EPI Pt. 4 §6.
 *
 * Horizontal scroll lane of contested-frontier items. Each card names
 * the *specific* unanswered move (CQ prompt / scheme-typical undercut /
 * undermined premise text) and ships a one-click "Open this thread"
 * CTA that prefills the deliberation composer.
 *
 * The CTA dispatches `mesh:openComposer` on `window` with a structured
 * detail payload. Composer mounts (existing or future) listen for this
 * event and open prefilled. We do not couple this component to the
 * composer's internal state directly — the event channel keeps the lane
 * usable from the embeddable widget too.
 *
 * `mesh:openComposer` detail shape:
 *   {
 *     deliberationId: string;
 *     targetArgumentId: string;
 *     kind: "answer-cq" | "raise-undercut" | "raise-undermine" | "support-leaf";
 *     schemeKey?: string;        // when kind === "answer-cq"
 *     cqKey?: string;            // when kind === "answer-cq"
 *     undercutTypeKey?: string;  // when kind === "raise-undercut" && scheme-typical
 *     premiseId?: string;        // when kind === "raise-undermine"
 *   }
 */
"use client";

import * as React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ContestedFrontier,
  FrontierUnansweredUndercut,
  FrontierUnansweredUndermine,
  FrontierUnansweredCQ,
  FrontierTerminalLeaf,
  MinimalDisagreement,
} from "@/lib/deliberation/frontier";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

type ComposerEventDetail = {
  deliberationId: string;
  targetArgumentId: string;
  kind: "answer-cq" | "raise-undercut" | "raise-undermine" | "support-leaf";
  schemeKey?: string;
  cqKey?: string;
  undercutTypeKey?: string;
  premiseId?: string;
};

type Props = {
  deliberationId: string;
  /** Optional pre-fetched data — when omitted we SWR the frontier endpoint. */
  data?: ContestedFrontier;
  /** Limit total items rendered. Default 24. */
  limit?: number;
  /** Sort order forwarded to the frontier endpoint when fetching. */
  sortBy?: "loadBearingness" | "recency" | "severity";
};

export function FrontierLane({
  deliberationId,
  data,
  limit = 24,
  sortBy = "loadBearingness",
}: Props) {
  const swr = useSWR<ContestedFrontier>(
    !data && deliberationId
      ? `/api/v3/deliberations/${encodeURIComponent(deliberationId)}/frontier?sortBy=${encodeURIComponent(sortBy)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60_000,
      dedupingInterval: 30_000,
    },
  );

  const frontier = data ?? swr.data;
  if (!frontier && (swr.isLoading || !data)) {
    return <FrontierLaneSkeleton />;
  }
  if (!frontier) return null;

  const items = collectItems(frontier).slice(0, limit);

  if (items.length === 0) {
    return (
      <div
        className="w-full rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900"
        data-testid="frontier-lane-empty"
      >
        No open dialectical edges. Every named scheme-required move has been
        raised or answered.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-rose-200/60 bg-gradient-to-r from-white via-rose-50/30 to-white p-2" data-testid="frontier-lane">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs uppercase tracking-wide text-amber-900 font-semibold">
          Contested frontier
        </div>
        <div className="text-[11px] mr-2 text-slate-500">
          {items.length} open thread{items.length === 1 ? "" : "s"}
        </div>
      </div>
      <MinimalDisagreementBanner value={frontier.minimalDisagreement} />
      <div
        className="flex gap-3 overflow-x-auto custom-scrollbar rounded-xl pb-3 px-1 snap-x"
        data-testid="frontier-lane-scroll"
      >
        {items.map((item) => (
          <FrontierItemCard
            key={item.key}
            deliberationId={deliberationId}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Item normalization
// ────────────────────────────────────────────────────────────────

type LaneItem =
  | {
      key: string;
      kind: "undercut";
      severity: "scheme-required" | "scheme-recommended" | "actively-raised";
      raw: FrontierUnansweredUndercut;
    }
  | {
      key: string;
      kind: "undermine";
      severity: "actively-raised";
      raw: FrontierUnansweredUndermine;
    }
  | {
      key: string;
      kind: "cq";
      severity: "scheme-required" | "scheme-recommended";
      raw: FrontierUnansweredCQ;
    }
  | {
      key: string;
      kind: "leaf";
      severity: "scheme-recommended";
      raw: FrontierTerminalLeaf;
    };

function collectItems(f: ContestedFrontier): LaneItem[] {
  const items: LaneItem[] = [];

  for (let i = 0; i < f.unansweredUndercuts.length; i++) {
    const u = f.unansweredUndercuts[i];
    items.push({
      key: `uc-${i}-${u.targetArgumentId}-${u.undercutTypeKey ?? "raised"}`,
      kind: "undercut",
      severity: u.severity,
      raw: u,
    });
  }
  for (let i = 0; i < f.unansweredUndermines.length; i++) {
    const u = f.unansweredUndermines[i];
    items.push({
      key: `um-${i}-${u.targetArgumentId}-${u.targetPremiseId}`,
      kind: "undermine",
      severity: "actively-raised",
      raw: u,
    });
  }
  for (let i = 0; i < f.unansweredCqs.length; i++) {
    const c = f.unansweredCqs[i];
    items.push({
      key: `cq-${i}-${c.targetArgumentId}-${c.cqKey}`,
      kind: "cq",
      severity: c.severity,
      raw: c,
    });
  }
  for (let i = 0; i < f.terminalLeaves.length; i++) {
    const t = f.terminalLeaves[i];
    items.push({
      key: `leaf-${i}-${t.argumentId}`,
      kind: "leaf",
      severity: "scheme-recommended",
      raw: t,
    });
  }

  // Stable sort: scheme-required > actively-raised > scheme-recommended.
  // The endpoint already applies its own ordering, but we re-rank locally
  // because we are interleaving four separate streams.
  const rank: Record<LaneItem["severity"], number> = {
    "scheme-required": 0,
    "actively-raised": 1,
    "scheme-recommended": 2,
  };
  items.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return items;
}

// ────────────────────────────────────────────────────────────────
// Minimal-disagreement banner
// ────────────────────────────────────────────────────────────────
//
// The `basis` tag is load-bearing: per the dev spec
// (RESEARCH_PROGRAMME/DEV_SPEC-minimal-disagreement-extractor-2026-06-04.md §6)
// the surface may render "minimal" copy ONLY when `basis === "minimal-T008"`.
// Off the faithful region we say "first point of divergence" or render nothing,
// never "minimal".

function MinimalDisagreementBanner({
  value,
}: {
  value: MinimalDisagreement | null | undefined;
}) {
  if (!value) return null;

  // Heuristic fallback carries no verified locus claim — keep the surface quiet.
  if (value.basis === "heuristic-fallback") return null;

  const isMinimal = value.basis === "minimal-T008";
  const isBranching = value.basis === "smyth-minimal-T009";

  // Branching (T009): the Smyth-minimal separating ANTICHAIN — a minimal SET of
  // per-line divergence points (never a single ⊑-least locus; branching has none).
  // Each element is a genuine first-divergence locus (T006/T008 per line); the
  // SET's Smyth-minimality is proven (T009, established). We say "minimal set of
  // unshared commitments, one per open line" — a minimal set, not a single point.
  if (isBranching) {
    const loci = value.loci ?? [];
    return (
      <div
        className="mx-1 mb-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2"
        data-testid="frontier-minimal-disagreement"
        data-basis={value.basis}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-900">
            Minimal disagreement set — one per open line
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {loci.length} line{loci.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="text-[11px] text-slate-700 leading-snug mt-1">
          This dispute branches: it diverges at several incomparable points, one
          per open line. This is the minimal SET of unshared commitments — proven
          the Smyth-minimal separating context (T009) — not a single smallest
          point (a branching dispute has none).
        </div>
        {loci.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {loci.map((l) => (
              <span
                key={l}
                className="text-[10px] font-mono text-indigo-700 bg-white/70 rounded px-1 py-0.5 border border-indigo-100"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const label = isMinimal
    ? "Minimal unshared commitment"
    : "First point of divergence";
  const detail = isMinimal
    ? "The ⊑-smallest commitment the two sides do not share — proven minimal (T008) on this single dispute line."
    : "Where this dispute line first diverges. Not necessarily the smallest point of disagreement.";

  return (
    <div
      className={`mx-1 mb-2 rounded-lg border p-2 ${
        isMinimal
          ? "border-violet-300 bg-violet-50/70"
          : "border-slate-200 bg-slate-50"
      }`}
      data-testid="frontier-minimal-disagreement"
      data-basis={value.basis}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] uppercase tracking-wide font-semibold ${
            isMinimal ? "text-violet-900" : "text-slate-600"
          }`}
        >
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-400">{value.locus}</span>
      </div>
      <div className="text-[11px] text-slate-700 leading-snug mt-1">{detail}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────

function FrontierItemCard({
  deliberationId,
  item,
}: {
  deliberationId: string;
  item: LaneItem;
}) {
  const { title, body } = describeItem(item);
  const targetArgumentId = extractTargetArgumentId(item);

  const onOpen = () => {
    if (typeof window === "undefined") return;
    const detail: ComposerEventDetail = {
      deliberationId,
      targetArgumentId,
      kind: kindForComposer(item),
      ...extraDetail(item),
    };
    window.dispatchEvent(new CustomEvent("mesh:openComposer", { detail }));
    // Also nudge any existing composer to scroll into view (existing channel).
    window.dispatchEvent(
      new CustomEvent("mesh:composer:focus", { detail: { deliberationId } }),
    );
  };

  const sevColor =
    item.severity === "scheme-required"
      ? "border-rose-300 bg-rose-50/60"
      : item.severity === "actively-raised"
        ? "border-amber-300 bg-amber-50/60"
        : "border-slate-200 bg-white";

  const sevBadge =
    item.severity === "scheme-required"
      ? "bg-rose-100 text-rose-900 border-rose-300"
      : item.severity === "actively-raised"
        ? "bg-amber-100 text-amber-900 border-amber-300"
        : "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <Card
      className={`shrink-0 w-72 p-3 snap-start flex flex-col  justify-between ${sevColor}`}
      data-testid="frontier-item-card"
      data-frontier-kind={item.kind}
      data-frontier-severity={item.severity}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge variant="outline" className={`text-[10px] uppercase ${sevBadge}`}>
            {item.kind === "cq"
              ? "CQ"
              : item.kind === "undercut"
                ? "undercut"
                : item.kind === "undermine"
                  ? "undermine"
                  : "leaf"}
          </Badge>
          <Badge variant="outline" className={`text-[10px] ${sevBadge}`}>
            {item.severity}
          </Badge>
        </div>
        <div className="text-xs font-semibold text-slate-900 mb-1 leading-snug">
          {title}
        </div>
        <div className="text-[11px] text-slate-700 leading-snug whitespace-pre-wrap">
          {body}
        </div>
        <div className="text-[10px] font-mono text-slate-400 mt-2">
          target: {targetArgumentId.slice(0, 10)}
          {targetArgumentId.length > 10 ? "…" : ""}
        </div>
      </div>
      <Button
        type="button"


        className="mt-1 mb-1 border-amber-400 bg-orange-50 text-amber-900 hover:bg-orange-100"
        onClick={onOpen}
        data-testid="frontier-item-open-thread"
      >
        Open this thread
      </Button>
    </Card>
  );
}

function describeItem(item: LaneItem): { title: string; body: string } {
  switch (item.kind) {
    case "undercut": {
      const u = item.raw;
      if (u.schemeTypical && u.undercutTypeKey) {
        return {
          title: `Scheme-typical undercut absent: "${u.undercutTypeKey}"`,
          body: "The scheme catalog expects this undercut to be raised on this argument. Nobody has raised it yet.",
        };
      }
      return {
        title: "Unanswered undercut",
        body: "An undercut has been raised against this argument and not yet rebutted.",
      };
    }
    case "undermine":
      return {
        title: "Unanswered premise attack",
        body: "A premise of this argument is under attack with no counter-argument yet.",
      };
    case "cq": {
      const c = item.raw;
      return {
        title: `CQ "${c.cqKey}" unanswered`,
        body: c.cqPrompt || `Critical question "${c.cqKey}" has no recorded answer.`,
      };
    }
    case "leaf":
      return {
        title: "Terminal leaf",
        body: "An un-attacked argument off the main conclusion path. Engaging it could shift the chain.",
      };
  }
}

function extractTargetArgumentId(item: LaneItem): string {
  switch (item.kind) {
    case "undercut":
    case "undermine":
    case "cq":
      return item.raw.targetArgumentId;
    case "leaf":
      return item.raw.argumentId;
  }
}

function kindForComposer(item: LaneItem): ComposerEventDetail["kind"] {
  switch (item.kind) {
    case "undercut":
      return "raise-undercut";
    case "undermine":
      return "raise-undermine";
    case "cq":
      return "answer-cq";
    case "leaf":
      return "support-leaf";
  }
}

function extraDetail(item: LaneItem): Partial<ComposerEventDetail> {
  switch (item.kind) {
    case "undercut":
      return item.raw.schemeTypical && item.raw.undercutTypeKey
        ? { undercutTypeKey: item.raw.undercutTypeKey }
        : {};
    case "undermine":
      return { premiseId: item.raw.targetPremiseId };
    case "cq":
      return { schemeKey: item.raw.schemeKey, cqKey: item.raw.cqKey };
    case "leaf":
      return {};
  }
}

function FrontierLaneSkeleton() {
  return (
    <div className="w-full" aria-busy>
      <div className="h-4 w-40 bg-slate-200 rounded mb-2 animate-pulse" />
      <div className="flex gap-3 overflow-x-auto pb-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="shrink-0 w-72 h-36 rounded border border-slate-200 bg-slate-50 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

export default FrontierLane;
