"use client";

/**
 * EquityWarningChip — C3.8
 *
 * Inline chip for claim/argument cards. Reads the most recent breakdown for
 * `ATTENTION_DEFICIT` and `CHALLENGE_CONCENTRATION` for the parent
 * deliberation and surfaces a warning when the chip's `targetId` appears in
 * the offending set.
 *
 * This component is intentionally cheap: it consumes the same metrics
 * snapshot SWR cache as `EquityPanel`, so no extra HTTP traffic is incurred
 * beyond the existing 15s metric poll.
 */

import * as React from "react";
import { useFacilitationCurrentMetrics } from "@/components/facilitation/hooks";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";

export interface EquityWarningChipProps {
  deliberationId: string;
  /** Argument id, claim id, or author id depending on the metric kind. */
  targetType: "claim" | "argument" | "author";
  targetId: string;
  className?: string;
}

interface AttentionBreakdown {
  staleClaimIds?: string[];
  staleClaimCount?: number;
}

interface ConcentrationBreakdown {
  topKAuthorIds?: string[];
}

export function EquityWarningChip({
  deliberationId,
  targetType,
  targetId,
  className,
}: EquityWarningChipProps) {
  const { data } = useFacilitationCurrentMetrics(deliberationId);
  const snapshots = data?.snapshots ?? [];
  const attention = snapshots.find((s) => s?.metricKind === "ATTENTION_DEFICIT");
  const concentration = snapshots.find(
    (s) => s?.metricKind === "CHALLENGE_CONCENTRATION",
  );

  let warn: { label: string; reason: string } | null = null;

  if (
    (targetType === "claim" || targetType === "argument") &&
    attention &&
    attention.value >= 0.3
  ) {
    const b = (attention.breakdownJson ?? {}) as AttentionBreakdown;
    if (Array.isArray(b.staleClaimIds) && b.staleClaimIds.includes(targetId)) {
      warn = {
        label: "needs response",
        reason: `Attention deficit at ${(attention.value * 100).toFixed(0)}% — this claim has no engagement since the reply window opened.`,
      };
    }
  }

  if (
    !warn &&
    targetType === "author" &&
    concentration &&
    concentration.value >= 0.5
  ) {
    const b = (concentration.breakdownJson ?? {}) as ConcentrationBreakdown;
    if (Array.isArray(b.topKAuthorIds) && b.topKAuthorIds.includes(targetId)) {
      warn = {
        label: "challenge-heavy",
        reason: `Challenge concentration at ${(concentration.value * 100).toFixed(0)}% — this author is in the top-K originating challenges.`,
      };
    }
  }

  if (!warn) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 ${className ?? ""}`}
          >
            <AlertTriangle className="h-3 w-3" />
            {warn.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{warn.reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
