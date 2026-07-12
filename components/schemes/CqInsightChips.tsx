"use client";
// components/schemes/CqInsightChips.tsx
//
// Shared presentational chips for the Session 11b lib primitives, rendered on
// BOTH critical-question surfaces (the claim-level CriticalQuestionsV3 and the
// argument-level SchemeSpecificCQsModal) so they stay consistent:
//   • item 5 — FACTUAL / EVALUATIVE / STRUCTURAL divergence type
//   • item 2 — CQ→scheme cross-references ("Opens" / "Competes with")
//   • item 4 — "Presumed unless challenged" hint on unsatisfied ASSUMPTION CQs
//
// Pure: reads only the client-safe lib primitives, no data fetching.

import * as React from "react";
import { Link2 } from "lucide-react";
import { getCqCrossReferences } from "@/lib/schemes/cq-cross-references";
import { classifyDivergence, type DivergenceType } from "@/lib/schemes/divergence-type";

const DIVERGENCE_CHIP: Record<
  DivergenceType,
  { label: string; className: string; title: string }
> = {
  FACTUAL: {
    label: "Factual",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
    title: "Factual disagreement — resolvable by evidence.",
  },
  EVALUATIVE: {
    label: "Evaluative",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    title:
      "Evaluative disagreement — about a value or goal; resolvable, if at all, by deliberation.",
  },
  STRUCTURAL: {
    label: "Structural",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    title:
      "Structural disagreement — about the options/feasibility; resolvable by naming an alternative.",
  },
};

// "negative_consequences" → "Negative Consequences"
function humanizeSchemeKey(key: string): string {
  return key
    .split(/[_-]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function CqInsightChips({
  schemeKey,
  cqKey,
  premiseType,
  satisfied = false,
  className = "mt-2 flex flex-wrap items-center gap-2",
}: {
  schemeKey: string;
  cqKey: string;
  premiseType?: string | null;
  satisfied?: boolean;
  className?: string;
}) {
  const divergence = classifyDivergence(schemeKey, cqKey);
  const crossRefs = getCqCrossReferences(schemeKey, cqKey);
  const isAssumption = premiseType === "ASSUMPTION";

  const showPresumed = isAssumption && !satisfied;
  if (!divergence.type && crossRefs.length === 0 && !showPresumed) return null;

  return (
    <div className={className}>
      {divergence.type && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DIVERGENCE_CHIP[divergence.type].className}`}
          title={DIVERGENCE_CHIP[divergence.type].title}
        >
          {DIVERGENCE_CHIP[divergence.type].label}
        </span>
      )}
      {crossRefs.map((ref) => (
        <span
          key={`${ref.fromCq}-${ref.refScheme}-${ref.relation}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
          title={ref.rationale}
        >
          <Link2 className="w-3 h-3" />
          {ref.relation === "opens" ? "Opens" : "Competes with"}:{" "}
          {humanizeSchemeKey(ref.refScheme)}
        </span>
      ))}
      {showPresumed && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200"
          title="Presumed acceptable unless a challenger raises it (Carneades assumption premise). It does not block close until contested."
        >
          Presumed unless challenged
        </span>
      )}
    </div>
  );
}
