"use client";

/**
 * ChainValidityBadge — C3.5 / Scope A parity.
 *
 * Renders a compact badge reflecting the integrity of an append-only
 * hash-chain. Used in both the FacilitationTimeline (live) and the
 * FacilitationReport (post-close attestation).
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, ShieldAlert, ShieldQuestion } from "lucide-react";

export interface ChainValidityBadgeProps {
  /** True when the server reports the chain verifies end-to-end. */
  valid: boolean | null | undefined;
  /** 0-based index of the first failed event when `valid === false`. */
  failedIndex?: number | null;
  /** Human-readable name of the chain (shown in the tooltip). */
  chainLabel?: string;
  className?: string;
}

export function ChainValidityBadge({
  valid,
  failedIndex,
  chainLabel = "hash chain",
  className,
}: ChainValidityBadgeProps) {
  if (valid === undefined || valid === null) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1 border-slate-300 text-slate-500 ${className ?? ""}`}
            >
              <ShieldQuestion className="h-3 w-3" />
              <span>Chain pending</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Chain attestation not yet computed.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (valid) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 ${className ?? ""}`}
            >
              <Check className="h-3 w-3" />
              <span>Chain verified</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            All events in this {chainLabel} verify end-to-end.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="destructive"
            className={`gap-1 ${className ?? ""}`}
            role="alert"
          >
            <ShieldAlert className="h-3 w-3" />
            <span>Chain mismatch</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          The {chainLabel} failed verification
          {typeof failedIndex === "number" ? ` at event #${failedIndex}` : ""}. Stop
          accepting writes and contact an admin.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
