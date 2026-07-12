"use client";

/**
 * GroupedCitationList Component
 *
 * Phase 2.3 of Stacks Improvement Roadmap
 *
 * Displays citations grouped by intent (supports, refutes, context, unclassified).
 * Shows prompts for missing counter-evidence to encourage epistemic balance.
 */

import { useMemo } from "react";
import { CitationCard } from "./CitationCard";
import { IntentBadge, CitationIntentType } from "./IntentSelector";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  InfoIcon,
  HelpCircleIcon,
} from "lucide-react";
import { CitationWithSource } from "@/lib/citations/navigation";
import { cn } from "@/lib/utils";

interface GroupedCitationListProps {
  citations: Array<CitationWithSource & { intent?: CitationIntentType | null }>;
  showGroups?: boolean;
  showMissingEvidencePrompt?: boolean;
  compact?: boolean;
  className?: string;
}

interface CitationGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  citations: Array<CitationWithSource & { intent?: CitationIntentType | null }>;
}

export function GroupedCitationList({
  citations,
  showGroups = true,
  showMissingEvidencePrompt = true,
  compact = false,
  className,
}: GroupedCitationListProps) {
  const { groups, hasSupports, hasRefutes, unclassifiedCount } = useMemo(() => {
    if (!showGroups) {
      return {
        groups: [] as CitationGroup[],
        hasSupports: false,
        hasRefutes: false,
        unclassifiedCount: 0,
      };
    }

    const supporting: CitationWithSource[] = [];
    const refuting: CitationWithSource[] = [];
    const contextual: CitationWithSource[] = [];
    const unclassified: CitationWithSource[] = [];

    for (const citation of citations) {
      const intent = citation.intent;
      if (!intent) {
        unclassified.push(citation);
      } else if (intent === "supports") {
        supporting.push(citation);
      } else if (intent === "refutes") {
        refuting.push(citation);
      } else {
        // context, defines, method, background, acknowledges, example
        contextual.push(citation);
      }
    }

    const result: CitationGroup[] = [];

    if (supporting.length > 0) {
      result.push({
        key: "supports",
        label: "Supporting Evidence",
        icon: ThumbsUpIcon,
        iconColor: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        citations: supporting,
      });
    }

    if (refuting.length > 0) {
      result.push({
        key: "refutes",
        label: "Counter-Evidence",
        icon: ThumbsDownIcon,
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        citations: refuting,
      });
    }

    if (contextual.length > 0) {
      result.push({
        key: "context",
        label: "Context & Background",
        icon: InfoIcon,
        iconColor: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        citations: contextual,
      });
    }

    if (unclassified.length > 0) {
      result.push({
        key: "unclassified",
        label: "Unclassified",
        icon: HelpCircleIcon,
        iconColor: "text-gray-500 dark:text-gray-400",
        bgColor: "bg-gray-50 dark:bg-gray-900/30",
        citations: unclassified,
      });
    }

    return {
      groups: result,
      hasSupports: supporting.length > 0,
      hasRefutes: refuting.length > 0,
      unclassifiedCount: unclassified.length,
    };
  }, [citations, showGroups]);

  // Simple flat list if grouping is disabled
  if (!showGroups) {
    return (
      <div className={cn("space-y-2", className)}>
        {citations.map((c) => (
          <CitationCard key={c.id} citation={c} compact={compact} />
        ))}
      </div>
    );
  }

  // Empty state
  if (citations.length === 0) {
    return (
      <div className={cn("text-center py-6 text-muted-foreground", className)}>
        <p className="text-sm">No evidence cited yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {groups.map((group) => (
        <div key={group.key}>
          <h4
            className={cn(
              "flex items-center gap-2 text-sm font-medium mb-2",
              group.iconColor
            )}
          >
            <group.icon className="h-4 w-4" />
            {group.label} ({group.citations.length})
          </h4>
          <div className={cn("rounded-lg p-2", group.bgColor)}>
            <div className="space-y-2">
              {group.citations.map((c) => (
                <CitationCard key={c.id} citation={c} compact={compact} />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Missing evidence prompts */}
      {showMissingEvidencePrompt && hasSupports && !hasRefutes && (
        <div className="p-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            ⚠️ No counter-evidence cited. Consider adding sources that challenge
            this claim for epistemic balance.
          </p>
        </div>
      )}

      {showMissingEvidencePrompt && !hasSupports && hasRefutes && (
        <div className="p-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/20">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            💡 Only counter-evidence cited. Consider adding supporting sources
            to show the full picture.
          </p>
        </div>
      )}

      {showMissingEvidencePrompt && unclassifiedCount > 0 && unclassifiedCount < citations.length && (
        <div className="p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            📝 {unclassifiedCount} citation{unclassifiedCount === 1 ? " is" : "s are"} unclassified.
            Adding intent helps readers understand how evidence relates to the claim.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Summary bar showing evidence balance at a glance
 */
export function EvidenceBalanceBar({
  citations,
  className,
}: {
  citations: Array<{ intent?: CitationIntentType | null }>;
  className?: string;
}) {
  const counts = useMemo(() => {
    let supports = 0;
    let refutes = 0;
    let other = 0;

    for (const c of citations) {
      if (c.intent === "supports") supports++;
      else if (c.intent === "refutes") refutes++;
      else other++;
    }

    return { supports, refutes, other, total: citations.length };
  }, [citations]);

  if (counts.total === 0) return null;

  const supportPercent = (counts.supports / counts.total) * 100;
  const refutePercent = (counts.refutes / counts.total) * 100;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="text-green-600">{counts.supports} supporting</span>
        <span className="text-red-600">{counts.refutes} refuting</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
        {supportPercent > 0 && (
          <div
            className="bg-green-500 h-full"
            style={{ width: `${supportPercent}%` }}
          />
        )}
        {refutePercent > 0 && (
          <div
            className="bg-red-500 h-full"
            style={{ width: `${refutePercent}%` }}
          />
        )}
        {counts.other > 0 && (
          <div
            className="bg-gray-400 h-full flex-1"
          />
        )}
      </div>
    </div>
  );
}
