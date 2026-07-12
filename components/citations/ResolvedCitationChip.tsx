/**
 * ResolvedCitationChip — the canonical "what did the resolver find?" widget.
 *
 * Phase 5 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 *   <ResolvedCitationChip url={input} onResolved={data => …} />
 *
 * Renders one of four states:
 *   - idle     → nothing (the input is not a URL/DOI yet)
 *   - loading  → spinner + "Resolving…" + skeleton text
 *   - ready    → confidence badge + short citation + tooltip with full bib
 *   - error    → small grey URL-only chip ("offline / dead / blocked")
 *
 * The chip is purely *informational*. It does not write to any list of
 * pending citations on its own; the parent owns that state and just
 * passes the URL down. When resolution succeeds the parent receives the
 * full ResolveResponse via `onResolved` and can persist whatever fields
 * it needs (Source.id, confidence, etc.).
 */

"use client";

import * as React from "react";
import { Loader2, ExternalLink, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useResolveCitation, type ResolveResponse } from "@/lib/citation/useResolveCitation";
import { formatCitationShort } from "@/lib/citation/format";

interface Props {
  /** A URL or DOI. Empty string disables the chip. */
  url: string;
  /** Pause resolution while false. */
  enabled?: boolean;
  /** Fired whenever the resolver returns a fresh, non-error response. */
  onResolved?: (response: ResolveResponse) => void;
  /** Optional className appended to the outer wrapper. */
  className?: string;
}

const CONFIDENCE_BADGE: Record<
  "high" | "medium" | "low" | "none",
  { label: string; cls: string; icon: React.ReactNode; tooltip: string }
> = {
  high: {
    label: "verified",
    cls: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    tooltip: "DOI content negotiation succeeded.",
  },
  medium: {
    label: "scraped",
    cls: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    tooltip:
      "Highwire/OpenAlex returned bibliographic metadata, but no DOI was confirmed.",
  },
  low: {
    label: "partial",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <HelpCircle className="h-3 w-3" />,
    tooltip:
      "Sparse metadata (OG tags / Twitter card). Consider editing the citation manually.",
  },
  none: {
    label: "unresolved",
    cls: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <AlertTriangle className="h-3 w-3" />,
    tooltip: "No source could be resolved from this URL.",
  },
};

export default function ResolvedCitationChip({
  url,
  enabled = true,
  onResolved,
  className = "",
}: Props) {
  const { state, data, error } = useResolveCitation(url, { enabled });

  // Bubble fresh results to the parent. Effect (not render-time) so the
  // parent's setState doesn't cause render loops.
  React.useEffect(() => {
    if (state === "ready" && data) onResolved?.(data);
  }, [state, data, onResolved]);

  if (state === "idle") return null;

  if (state === "loading") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-[11px] text-slate-500 ${className}`}
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Resolving citation…
      </div>
    );
  }

  if (state === "error") {
    // Offline-graceful: degrade to a flat URL chip so the user still sees
    // *something*, but no confidence claim is made.
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-[11px] text-slate-500 ${className}`}
        title={error ?? "Resolver unreachable"}
      >
        <AlertTriangle className="h-3 w-3 text-orange-500" />
        <span className="truncate max-w-[200px]">{tryHostname(url)}</span>
      </div>
    );
  }

  // state === "ready"
  if (!data) return null;
  const meta = CONFIDENCE_BADGE[data.confidence];
  const short = data.citation
    ? formatCitationShort(data.citation)
    : tryHostname(url);
  const targetUrl = data.citation?.url ?? url;
  const enrichers =
    data.enrichedBy?.length ? ` (+${data.enrichedBy.join(", ")})` : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`inline-flex items-start gap-1.5 max-w-full text-[11px] rounded border px-2 py-1 bg-white ${className}`}
        >
          <Badge
            variant="outline"
            className={`shrink-0 h-4 text-[10px] inline-flex items-center gap-1 ${meta.cls}`}
          >
            {meta.icon}
            {meta.label}
          </Badge>
          <span className="truncate text-slate-800">{short}</span>
          {targetUrl && (
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-slate-400 hover:text-slate-700"
              onClick={(e) => e.stopPropagation()}
              title="Open source"
              aria-label="Open source in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm text-[11px] leading-snug">
        <div className="space-y-1">
          <div className="font-medium">{short}</div>
          <div className="text-slate-300">
            via {data.resolvedFrom}
            {enrichers} · {data.cached ? "cached" : `${data.durationMs}ms`}
          </div>
          <div className="text-slate-300">{meta.tooltip}</div>
          {data.citation?.doi && (
            <div className="text-slate-300">DOI: {data.citation.doi}</div>
          )}
          {data.archiveUrl && (
            <div className="text-slate-300">
              Archive:{" "}
              <a
                href={data.archiveUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                Wayback snapshot
              </a>
            </div>
          )}
          {data.resolvedFrom === "llm" && (
            <div className="text-orange-300">
              AI-extracted — please verify before publishing.
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
