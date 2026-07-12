"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useContraryCount, type ContraryItem } from "./useContraryCount";
import { focusAspicForClaim } from "@/components/aspic/focusClaim";

export type ContraryBadgeProps = {
  deliberationId?: string | null;
  claimId?: string | null;
  /**
   * Text of the focal claim. When provided, the tooltip exposes a
   * "View in ASPIC" link that focuses the ASPIC results panel on this claim.
   */
  claimText?: string | null;
  /** Default "sm". */
  size?: "xs" | "sm";
  /** Render even when count is zero. Default false. */
  showWhenZero?: boolean;
  /** Optional override label noun (e.g., "rebuttal"). Default "Contrary". */
  label?: string;
  className?: string;
};

const MAX_PREVIEW = 5;

function previewList(items: ContraryItem[]) {
  return items
    .map((it) => ({
      text: it.otherText || "Unknown claim",
      direction: it.direction,
      isSymmetric: it.isSymmetric,
      reason: it.reason ?? null,
      author:
        it.createdBy?.username ||
        it.createdBy?.name ||
        null,
    }))
    .slice(0, MAX_PREVIEW);
}

/**
 * Compact rose pill showing how many ACTIVE contrary relations a claim
 * participates in (both outgoing and incoming). Hover reveals up to the first
 * five contrary claim texts with direction markers.
 *
 * Subscribes to the global `contraries:changed` event and refetches when its
 * focal claim is referenced (or when the event has no detail).
 */
export function ContraryBadge({
  deliberationId,
  claimId,
  claimText,
  size = "sm",
  showWhenZero = false,
  label = "Contrary",
  className,
}: ContraryBadgeProps) {
  const { count, items, outgoing, incoming } = useContraryCount({
    deliberationId,
    claimId,
  });

  if (!showWhenZero && count === 0) return null;

  const sizeCls =
    size === "xs"
      ? "px-1.5 py-0 text-[10px] gap-0.5"
      : "px-2 py-0.5 text-xs gap-1";

  const noun =
    count === 1
      ? label
      : label.endsWith("y")
      ? `${label.slice(0, -1)}ies`
      : `${label}s`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            data-contrary-count={count}
            data-contrary-outgoing={outgoing.length}
            data-contrary-incoming={incoming.length}
            className={
              "border-rose-500 text-rose-600 bg-rose-50 hover:bg-rose-100 cursor-help transition-colors inline-flex items-center " +
              sizeCls +
              (className ? ` ${className}` : "")
            }
          >
            <AlertTriangle
              className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"}
              aria-hidden="true"
            />
            <span>
              {count} {noun}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-semibold mb-2">
            This claim participates in {count} contrary relation
            {count !== 1 ? "s" : ""}.
          </p>
          {outgoing.length > 0 && (
            <p className="text-[10px] text-gray-400 mb-1">
              {outgoing.length} outgoing (this claim contradicts)
            </p>
          )}
          {incoming.length > 0 && (
            <p className="text-[10px] text-gray-400 mb-2">
              {incoming.length} incoming (other claims contradict this)
            </p>
          )}
          <ul className="text-xs text-gray-300 space-y-1.5 list-none">
            {previewList(items).map((p, i) => (
              <li key={i} className="leading-tight">
                <span
                  className="font-mono mr-1 text-gray-400"
                  aria-hidden="true"
                  title={
                    p.direction === "outgoing"
                      ? "outgoing"
                      : "incoming"
                  }
                >
                  {p.direction === "outgoing"
                    ? p.isSymmetric
                      ? "↔"
                      : "→"
                    : p.isSymmetric
                    ? "↔"
                    : "←"}
                </span>
                <span className="text-gray-100">{p.text}</span>
                {(p.author || p.reason) && (
                  <div className="ml-4 mt-0.5 text-[10px] text-gray-400">
                    {p.author && (
                      <span>
                        by <span className="text-gray-300">@{p.author}</span>
                      </span>
                    )}
                    {p.author && p.reason && <span> · </span>}
                    {p.reason && (
                      <span className="italic">&ldquo;{p.reason}&rdquo;</span>
                    )}
                  </div>
                )}
              </li>
            ))}
            {items.length > MAX_PREVIEW && (
              <li className="italic text-gray-400">
                …and {items.length - MAX_PREVIEW} more
              </li>
            )}
          </ul>
          {claimText && claimId && (
            <button
              type="button"
              onClick={() => focusAspicForClaim({ claimId, claimText })}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-rose-300 hover:text-rose-200 underline-offset-2 hover:underline"
              data-testid="contrary-view-in-aspic"
            >
              View in ASPIC results
              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            </button>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
