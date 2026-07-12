"use client";

/**
 * AxisBadge — small reusable badge showing a disagreement axis.
 *
 * Used by `DisagreementTagger`, `TypologyCandidateQueue`,
 * `MetaConsensusSummaryCard`, and the optional map integration.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { AXIS_CLASSES, AXIS_LABEL, type DisagreementAxisKey } from "./hooks";

export interface AxisBadgeProps {
  axisKey: DisagreementAxisKey;
  count?: number;
  className?: string;
  /** When set, shows a confidence (`0.00`–`1.00`) suffix. */
  confidence?: string | number;
}

export function AxisBadge({
  axisKey,
  count,
  confidence,
  className,
}: AxisBadgeProps) {
  const palette = AXIS_CLASSES[axisKey];
  const label = AXIS_LABEL[axisKey];
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${palette.chip} ${className ?? ""}`}
      aria-label={`${label} disagreement${
        typeof count === "number" ? `, ${count} tag${count === 1 ? "" : "s"}` : ""
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="ml-0.5 rounded-full bg-white/60 px-1 text-[10px] font-semibold">
          {count}
        </span>
      )}
      {confidence !== undefined && (
        <span className="text-[10px] opacity-75">
          {typeof confidence === "string" ? confidence : confidence.toFixed(2)}
        </span>
      )}
    </Badge>
  );
}
