// lib/thesis/LiveBadgeStrip.tsx
//
// Living Thesis — Phase 1.3: shared "live badge" row used by retrofitted
// TipTap nodes (claim, argument, proposition, citation) on a thesis view
// page. Pulls per-object stats from `ThesisLiveContext` (Phase 1.2). Falls
// back gracefully when no provider is mounted (editor / preview), so the
// same node implementations work everywhere.
//
// Visuals:
//   - Live label dot (IN / OUT / UNDEC)        ← claim & argument-conclusion only
//   - Attack pill (⚔ red if undefended, 🛡 green if all defended)
//   - Evidence count
//   - CQ satisfaction (arguments only)
//   - "updated Xs ago" timestamp
//   - Soft pulse animation when stats just changed
//
// Click any badge → opens the inspector (Phase 2).

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Swords, ShieldCheck, Paperclip, HelpCircle, Clock } from "lucide-react";
import {
  type LiveKind,
  type LiveLabel,
  useOpenInspector,
  useThesisLiveObject,
} from "@/lib/thesis/ThesisLiveContext";

interface LiveBadgeStripProps {
  id: string | null | undefined;
  kind: LiveKind;
  /** Fallback label baked into the node attrs (used when no live data). */
  fallbackLabel?: LiveLabel;
  /** Hide the label dot (e.g. for proposition nodes that aren't labeled). */
  hideLabel?: boolean;
  /** Compact variant for inline badges. */
  compact?: boolean;
}

const LABEL_DOT: Record<LiveLabel, { cls: string; title: string }> = {
  IN: { cls: "bg-emerald-500", title: "Warranted (IN)" },
  OUT: { cls: "bg-rose-500", title: "Defeated (OUT)" },
  UNDEC: { cls: "bg-zinc-500", title: "Undecided (UNDEC)" },
};

function formatAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function LiveBadgeStrip({
  id,
  kind,
  fallbackLabel,
  hideLabel,
  compact,
}: LiveBadgeStripProps) {
  const stats = useThesisLiveObject(id);
  const openInspector = useOpenInspector();

  // Soft pulse when lastChangedAt changes after the first paint.
  const [pulse, setPulse] = useState(false);
  const lastSeenRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const v = stats?.lastChangedAt;
    if (!v) return;
    if (lastSeenRef.current && lastSeenRef.current !== v) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1500);
      return () => clearTimeout(t);
    }
    lastSeenRef.current = v;
  }, [stats?.lastChangedAt]);

  // No id and no fallback: nothing to render.
  if (!id) return null;

  const label = stats?.label ?? fallbackLabel;
  const isLive = !!stats;

  const handleOpen = (tab?: Parameters<typeof openInspector>[0]["tab"]) => {
    openInspector({ kind, id, tab });
  };

  const sizeBadge = compact
    ? "px-1.5 py-0 text-[10px]"
    : "px-2 py-0.5 text-xs";

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 transition-opacity ${
        pulse ? "animate-pulse" : ""
      }`}
      data-live={isLive ? "true" : "false"}
    >
      {/* Label dot */}
      {!hideLabel && label && (
        <button
          type="button"
          onClick={() => handleOpen("overview")}
          title={LABEL_DOT[label].title}
          className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white ${sizeBadge} font-medium text-slate-700 hover:border-slate-300`}
        >
          <span
            className={`h-2 w-2 rounded-full ${LABEL_DOT[label].cls}`}
            aria-hidden
          />
          {label}
        </button>
      )}

      {/* Attacks */}
      {stats && stats.attackCount > 0 && (
        <button
          type="button"
          onClick={() => handleOpen("attacks")}
          title={`${stats.attackCount} attack${stats.attackCount === 1 ? "" : "s"} • ${stats.undefendedAttackCount} undefended`}
          className={`inline-flex items-center gap-1 rounded-full border ${sizeBadge} font-medium ${
            stats.undefendedAttackCount > 0
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
          }`}
        >
          {stats.undefendedAttackCount > 0 ? (
            <Swords className="h-3 w-3" />
          ) : (
            <ShieldCheck className="h-3 w-3" />
          )}
          {stats.undefendedAttackCount > 0
            ? `${stats.undefendedAttackCount} / ${stats.attackCount}`
            : stats.attackCount}
        </button>
      )}

      {/* Evidence */}
      {stats && stats.evidenceCount > 0 && (
        <button
          type="button"
          onClick={() => handleOpen("evidence")}
          title={`${stats.evidenceCount} evidence link${stats.evidenceCount === 1 ? "" : "s"}`}
          className={`inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 ${sizeBadge} font-medium text-sky-700 hover:border-sky-300`}
        >
          <Paperclip className="h-3 w-3" />
          {stats.evidenceCount}
        </button>
      )}

      {/* CQs (arguments only) */}
      {stats && typeof stats.cqTotal === "number" && stats.cqTotal > 0 && (
        <button
          type="button"
          onClick={() => handleOpen("cqs")}
          title={`Critical questions: ${stats.cqSatisfied ?? 0} of ${stats.cqTotal} satisfied`}
          className={`inline-flex items-center gap-1 rounded-full border ${sizeBadge} font-medium ${
            (stats.cqSatisfied ?? 0) === stats.cqTotal
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <HelpCircle className="h-3 w-3" />
          CQ {stats.cqSatisfied ?? 0}/{stats.cqTotal}
        </button>
      )}

      {/* Freshness */}
      {stats?.lastChangedAt && !compact && (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-slate-500"
          title={new Date(stats.lastChangedAt).toLocaleString()}
        >
          <Clock className="h-3 w-3" />
          {formatAgo(stats.lastChangedAt)}
        </span>
      )}
    </div>
  );
}
