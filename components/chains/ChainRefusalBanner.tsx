/**
 * ChainRefusalBanner — T1.4
 *
 * Surfaces the deliberation-level `refusalSurface.cannotConcludeBecause`
 * signal at the top of chain rendering views (Essay, Brief, etc.).
 *
 * Why this exists: both `ChainEssayView` and `ChainProseView` rendered
 * conclusions as if the chain closes, even when the readout's
 * refusalSurface explicitly said the conclusion is blocked. External
 * test (Claude Desktop, May 11) flagged this as the #1 source of
 * over-confident synthesis. A graph-honest renderer should never
 * silently print a closure the readout refuses.
 *
 * Behaviour:
 *   - Pulls /api/v3/deliberations/[id]/synthetic-readout (compact view).
 *   - Filters refusalSurface entries to those whose `conclusionClaimId`
 *     matches a conclusion claim id present in the chain's nodes.
 *   - When matches exist, renders a top banner with the count of
 *     blocking objections, the weakest-link blocker (first match), and
 *     up to N inline blocker preview lines (from `blockerSummaries`,
 *     hydrated by T1.1).
 *   - When no matches exist (chain conclusions all unblocked), renders
 *     nothing. Honest-empty — never asserts a positive "this chain is
 *     fine" claim, since absence of refusal ≠ presence of support.
 */

"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import { AlertOctagon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefusalSurfaceEntry {
  attemptedConclusion: string;
  conclusionClaimId: string;
  blockedBy:
    | "unanswered-undercut"
    | "unanswered-undermine"
    | "scheme-incompatibility"
    | "depth-thin";
  blockerIds: string[];
  blockerSummaries: string[];
}

interface SyntheticReadoutSlim {
  refusalSurface?: { cannotConcludeBecause?: RefusalSurfaceEntry[] };
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as SyntheticReadoutSlim;
  });

const BLOCKED_BY_LABEL: Record<RefusalSurfaceEntry["blockedBy"], string> = {
  "unanswered-undercut": "unanswered undercut",
  "unanswered-undermine": "unanswered undermine",
  "scheme-incompatibility": "scheme incompatibility",
  "depth-thin": "thin standing depth",
};

interface ChainRefusalBannerProps {
  /** Deliberation that owns this chain. */
  deliberationId: string;
  /**
   * Conclusion claim ids appearing in the chain. The banner only
   * renders entries whose `conclusionClaimId` is in this list — the
   * deliberation may have many other refusals that don't bear on this
   * chain.
   */
  chainConclusionClaimIds: string[];
  /** Compact mode for embedded surfaces. */
  compact?: boolean;
  /** Maximum blocker preview lines to show (default 2). */
  maxPreviews?: number;
}

export function ChainRefusalBanner({
  deliberationId,
  chainConclusionClaimIds,
  compact = false,
  maxPreviews = 2,
}: ChainRefusalBannerProps) {
  const { data } = useSWR<SyntheticReadoutSlim>(
    deliberationId
      ? `/api/v3/deliberations/${deliberationId}/synthetic-readout?view=compact`
      : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const matchedEntries = useMemo<RefusalSurfaceEntry[]>(() => {
    const all = data?.refusalSurface?.cannotConcludeBecause ?? [];
    if (all.length === 0 || chainConclusionClaimIds.length === 0) return [];
    const inChain = new Set(chainConclusionClaimIds);
    return all.filter((e) => inChain.has(e.conclusionClaimId));
  }, [data, chainConclusionClaimIds]);

  if (matchedEntries.length === 0) return null;

  // Weakest link = the first matching entry (refusalSurface is already
  // ordered by severity inside the readout: unanswered-undercut →
  // unanswered-undermine → scheme-incompatibility → depth-thin).
  const weakest = matchedEntries[0];
  const totalBlockers = matchedEntries.reduce(
    (sum, e) => sum + e.blockerIds.length,
    0,
  );

  const previews: string[] = [];
  for (const entry of matchedEntries) {
    for (const summary of entry.blockerSummaries) {
      if (!summary) continue;
      previews.push(summary);
      if (previews.length >= maxPreviews) break;
    }
    if (previews.length >= maxPreviews) break;
  }

  const matchCount = matchedEntries.length;
  const headline =
    matchCount === 1
      ? `This chain's conclusion is blocked by ${totalBlockers} unanswered ${
          totalBlockers === 1 ? "objection" : "objections"
        }.`
      : `This chain has ${matchCount} blocked conclusions (${totalBlockers} unanswered objections in total).`;

  return (
    <div
      className={cn(
        "rounded-md border border-amber-300 bg-amber-50 text-amber-900",
        compact ? "p-2" : "p-3",
      )}
      role="status"
      aria-label="Chain conclusion refusal banner"
    >
      <div className="flex items-start gap-2">
        <AlertOctagon
          className={cn(
            "shrink-0 text-amber-600",
            compact ? "w-4 h-4 mt-0.5" : "w-5 h-5 mt-0.5",
          )}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-medium leading-snug",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {headline}
          </p>
          <p
            className={cn(
              "text-amber-800/90 mt-0.5",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            Weakest link: <span className="italic">{weakest.attemptedConclusion}</span>{" "}
            <span className="text-amber-700">
              ({BLOCKED_BY_LABEL[weakest.blockedBy]})
            </span>
          </p>
          {previews.length > 0 && (
            <ul
              className={cn(
                "mt-1.5 space-y-0.5",
                compact ? "text-[11px]" : "text-xs",
              )}
            >
              {previews.map((summary, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1 text-amber-800/90"
                >
                  <ChevronRight
                    className="w-3 h-3 mt-0.5 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span className="line-clamp-2">{summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChainRefusalBanner;
