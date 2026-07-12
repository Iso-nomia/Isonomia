"use client";

/**
 * RemainingDisagreementsPanel — B3.7
 *
 * Compact deliberation-level surface that renders the latest PUBLISHED
 * meta-consensus summary at the top of pathway / report views so readers
 * understand the disagreements still on the table before they read the
 * institutional packet.
 *
 * Falls back gracefully when nothing has been published yet.
 */

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { AxisBadge } from "./AxisBadge";
import { MetaConsensusSummaryCard } from "./MetaConsensusSummaryCard";
import { useSummaries } from "./hooks";

export interface RemainingDisagreementsPanelProps {
  deliberationId: string;
  /** Default collapsed state. Defaults to true (expanded). */
  defaultOpen?: boolean;
  className?: string;
}

export function RemainingDisagreementsPanel({
  deliberationId,
  defaultOpen = true,
  className,
}: RemainingDisagreementsPanelProps) {
  const { data, isLoading } = useSummaries(deliberationId, { all: false });
  const [open, setOpen] = React.useState(defaultOpen);

  const latest = React.useMemo(() => {
    const list = data?.summaries ?? [];
    return list.find((s) => s.status === "PUBLISHED") ?? null;
  }, [data]);

  const distribution = React.useMemo(() => {
    if (!latest) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const row of latest.bodyJson?.disagreedOn ?? []) {
      m.set(row.axisKey, (m.get(row.axisKey) ?? 0) + 1);
    }
    return m;
  }, [latest]);

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 ${className ?? ""}`}>
        Loading meta-consensus context…
      </div>
    );
  }

  if (!latest) {
    return (
      <div className={`rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-500 ${className ?? ""}`}>
        <span className="font-medium text-slate-700">Remaining disagreements:</span>{" "}
        no published meta-consensus summary yet for this deliberation.
      </div>
    );
  }

  const publishedAt = latest.publishedAt
    ? new Date(latest.publishedAt).toLocaleDateString()
    : "—";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <div className="rounded-lg border border-violet-200 bg-gradient-to-r from-violet-50/60 via-white to-white">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
            <span className="text-sm font-semibold text-slate-900">
              Remaining disagreements
            </span>
            <span className="text-[11px] text-slate-500">
              v{latest.version} · published {publishedAt}
            </span>
            {Array.from(distribution.entries()).map(([axis, count]) => (
              <AxisBadge
                key={axis}
                axisKey={axis as Parameters<typeof AxisBadge>[0]["axisKey"]}
                count={count}
              />
            ))}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-violet-100 px-3 py-3">
            <MetaConsensusSummaryCard summary={latest} hydrate />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
