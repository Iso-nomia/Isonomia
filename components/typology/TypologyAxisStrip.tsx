"use client";

/**
 * TypologyAxisStrip — B3.6
 *
 * Compact "Tagged disagreement" row for embedding on argument / claim cards
 * in the deliberation map. Renders axis pills (with counts) and exposes a
 * per-axis tooltip listing the most-confident tag's evidence.
 *
 * Designed to be dropped in with minimal props; fetches its own tag list.
 */

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { AxisBadge } from "./AxisBadge";
import {
  AXIS_LABEL,
  fmtConfidence,
  useAxisIdToKey,
  useTags,
  type DisagreementAxisKey,
  type DisagreementTagDTO,
  type DisagreementTagTargetType,
} from "./hooks";

export interface TypologyAxisStripProps {
  deliberationId: string;
  targetType: DisagreementTagTargetType;
  targetId: string;
  /** Render nothing when there are zero tags. Default: true. */
  hideWhenEmpty?: boolean;
  className?: string;
}

export function TypologyAxisStrip({
  deliberationId,
  targetType,
  targetId,
  hideWhenEmpty = true,
  className,
}: TypologyAxisStripProps) {
  const { data } = useTags(deliberationId, { targetType, targetId });
  const axisIdToKey = useAxisIdToKey();
  const tags = React.useMemo(() => data?.tags ?? [], [data]);

  const grouped = React.useMemo(() => {
    const m = new Map<DisagreementAxisKey, DisagreementTagDTO[]>();
    for (const t of tags) {
      if (t.retractedAt) continue;
      const key = axisIdToKey.get(t.axisId);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    // Sort each group by confidence descending so the tooltip surfaces the strongest tag.
    for (const arr of m.values()) {
      arr.sort((a, b) => Number(b.confidence) - Number(a.confidence));
    }
    return m;
  }, [tags, axisIdToKey]);

  if (hideWhenEmpty && grouped.size === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 ${className ?? ""}`}
      aria-label="Tagged disagreements"
    >
      <span className="font-medium uppercase tracking-wide text-slate-500">
        Tagged disagreement
      </span>
      <TooltipProvider delayDuration={150}>
        {Array.from(grouped.entries()).map(([axis, items]) => (
          <Tooltip key={axis}>
            <TooltipTrigger asChild>
              <span>
                <AxisBadge axisKey={axis} count={items.length} />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs space-y-1 text-xs">
              <div className="font-semibold">
                {AXIS_LABEL[axis]} — confidence {fmtConfidence(items[0].confidence)}
              </div>
              <p className="line-clamp-3 text-slate-200">{items[0].evidenceText}</p>
              {items.length > 1 && (
                <p className="text-[10px] text-slate-300">
                  +{items.length - 1} more on this axis
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
