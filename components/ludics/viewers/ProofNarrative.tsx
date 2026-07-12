"use client";

/**
 * Phase 6 - Proof Narrative Component
 * 
 * Displays a justified narrative from a ludic interaction:
 * - Step-by-step argument flow
 * - Justification chains
 * - Conclusion highlighting
 * - Expandable/collapsible sections
 * 
 * Uses Phase 3 extraction/narrative-formatter output.
 */

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

type LudicAddress = number[];

interface NarrativeStep {
  /** Step number in sequence */
  stepNumber: number;

  /** Speaker identifier */
  speaker: string;

  /** Move type (claim, support, attack, etc.) */
  moveType: string;

  /** The actual content/expression */
  content: string;

  /** Address in the interaction tree */
  address: LudicAddress;

  /** Chain of prior steps that justify this one */
  justificationChain: number[];

  /** Polarity of this move */
  polarity: "+" | "-";

  /** Is this a daimon (giving up)? */
  isDaimon?: boolean;

  /** Optional timestamp */
  timestamp?: string;
}

interface JustifiedNarrative {
  /** Unique identifier */
  id: string;

  /** Title or summary */
  title?: string;

  /** The sequence of justified steps */
  steps: NarrativeStep[];

  /** Final conclusion */
  conclusion: {
    winner: "P" | "O" | "draw";
    summary: string;
    keyPoints: string[];
  };

  /** Metadata */
  metadata?: {
    interactionId?: string;
    arenaId?: string;
    generatedAt?: string;
    style?: "formal" | "conversational" | "academic";
  };
}

export interface ProofNarrativeProps {
  /** The narrative to display */
  narrative?: JustifiedNarrative | null;
  /** Interaction ID to fetch narrative from */
  interactionId?: string;
  /** Enable expandable sections */
  expandable?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Highlight specific steps */
  highlightedSteps?: number[];
  /** Show justification chains */
  showJustifications?: boolean;
  /** Show addresses */
  showAddresses?: boolean;
  /** Display style */
  style?: "cards" | "timeline" | "compact";
  /** Callback when step is clicked */
  onStepClick?: (step: NarrativeStep) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ============================================================================
// HELPERS
// ============================================================================

function addressToKey(address: LudicAddress | string | undefined): string {
  if (address === undefined || address === null) return "∅";
  if (typeof address === "string") {
    return address === "" ? "∅" : address;
  }
  if (Array.isArray(address)) {
    return address.length === 0 ? "∅" : `[${address.join(",")}]`;
  }
  return String(address);
}

function getMoveTypeStyle(moveType: string): { bg: string; icon: string } {
  switch (moveType.toLowerCase()) {
    case "claim":
      return { bg: "bg-blue-100 text-blue-800", icon: "💬" };
    case "support":
      return { bg: "bg-green-100 text-green-800", icon: "✓" };
    case "attack":
      return { bg: "bg-red-100 text-red-800", icon: "⚔" };
    case "concession":
      return { bg: "bg-yellow-100 text-yellow-800", icon: "🤝" };
    case "question":
    case "ask":
      return { bg: "bg-purple-100 text-purple-800", icon: "?" };
    case "argue":
      return { bg: "bg-indigo-100 text-indigo-800", icon: "📢" };
    case "negate":
      return { bg: "bg-orange-100 text-orange-800", icon: "✗" };
    case "daimon":
      return { bg: "bg-slate-100 text-slate-800", icon: "⊥" };
    default:
      return { bg: "bg-slate-100 text-slate-700", icon: "•" };
  }
}

function getSpeakerStyle(speaker: string, polarity: "+" | "-") {
  if (polarity === "+") {
    return {
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
      badge: "bg-blue-200 text-blue-800",
    };
  }
  return {
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-200 text-orange-800",
  };
}

// ============================================================================
// STEP CARD COMPONENT
// ============================================================================

interface StepCardProps {
  step: NarrativeStep;
  allSteps: NarrativeStep[];
  isHighlighted: boolean;
  showJustifications: boolean;
  showAddresses: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}

function StepCard({
  step,
  allSteps,
  isHighlighted,
  showJustifications,
  showAddresses,
  isExpanded,
  onToggle,
  onClick,
}: StepCardProps) {
  const moveStyle = getMoveTypeStyle(step.moveType);
  const speakerStyle = getSpeakerStyle(step.speaker, step.polarity);

  // Get justifying steps
  const justifyingSteps = step.justificationChain
    .map((num) => allSteps.find((s) => s.stepNumber === num))
    .filter(Boolean);

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        speakerStyle.bg,
        isHighlighted && "ring-2 ring-yellow-400 shadow-md"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 cursor-pointer",
          "hover:bg-white/50 transition-colors"
        )}
        onClick={onClick || onToggle}
      >
        {/* Step number */}
        <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-bold shadow-sm">
          {step.stepNumber}
        </span>

        {/* Move type badge */}
        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", moveStyle.bg)}>
          {moveStyle.icon} {step.moveType}
        </span>

        {/* Speaker */}
        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", speakerStyle.badge)}>
          {step.speaker}
        </span>

        {/* Polarity indicator */}
        <span
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
            step.polarity === "+"
              ? "bg-blue-200 text-blue-800"
              : "bg-orange-200 text-orange-800"
          )}
        >
          {step.polarity}
        </span>

        {/* Content preview */}
        <span className={cn("flex-1 truncate text-sm", speakerStyle.text)}>
          {step.isDaimon ? "(withdraws from position)" : step.content}
        </span>

        {/* Expand toggle */}
        {showJustifications && justifyingSteps.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 bg-white/30">
          {/* Full content */}
          <div className={cn("text-sm leading-relaxed", speakerStyle.text)}>
            {step.isDaimon ? (
              <em>{step.speaker} withdraws from this position (daimon)</em>
            ) : (
              step.content
            )}
          </div>

          {/* Address */}
          {showAddresses && (
            <div className="text-xs text-slate-500">
              Address: <code className="bg-white/50 px-1 rounded">{addressToKey(step.address)}</code>
            </div>
          )}

          {/* Justification chain */}
          {showJustifications && justifyingSteps.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Justified by:</div>
              <div className="flex flex-wrap gap-1">
                {justifyingSteps.map((js) => (
                  <span
                    key={js!.stepNumber}
                    className="text-xs px-2 py-0.5 rounded bg-white/70 border"
                  >
                    #{js!.stepNumber}: {js!.content.slice(0, 30)}...
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {step.timestamp && (
            <div className="text-xs text-slate-400">{step.timestamp}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TIMELINE VIEW
// ============================================================================

interface TimelineViewProps {
  steps: NarrativeStep[];
  highlightedSteps: Set<number>;
  showJustifications: boolean;
  showAddresses: boolean;
  onStepClick?: (step: NarrativeStep) => void;
}

function TimelineView({
  steps,
  highlightedSteps,
  showJustifications,
  showAddresses,
  onStepClick,
}: TimelineViewProps) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => {
          const moveStyle = getMoveTypeStyle(step.moveType);
          const speakerStyle = getSpeakerStyle(step.speaker, step.polarity);
          const isHighlighted = highlightedSteps.has(step.stepNumber);

          return (
            <div
              key={step.stepNumber}
              className={cn(
                "relative pl-10 cursor-pointer",
                isHighlighted && "bg-yellow-50 -mx-2 px-12 py-2 rounded"
              )}
              onClick={() => onStepClick?.(step)}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute left-2 w-5 h-5 rounded-full border-2 border-white shadow",
                  step.polarity === "+" ? "bg-blue-500" : "bg-orange-500"
                )}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">
                  {step.stepNumber}
                </span>
              </div>

              {/* Content */}
              <div className={cn("border rounded-lg p-3", speakerStyle.bg)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("px-2 py-0.5 rounded text-xs", speakerStyle.badge)}>
                    {step.speaker}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded text-xs", moveStyle.bg)}>
                    {moveStyle.icon} {step.moveType}
                  </span>
                  {showAddresses && (
                    <code className="text-xs text-slate-400">{addressToKey(step.address)}</code>
                  )}
                </div>
                <div className={cn("text-sm", speakerStyle.text)}>
                  {step.isDaimon ? <em>(withdraws)</em> : step.content}
                </div>
                {showJustifications && step.justificationChain.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    ← Justified by: {step.justificationChain.map((n) => `#${n}`).join(", ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT VIEW
// ============================================================================

interface CompactViewProps {
  steps: NarrativeStep[];
  highlightedSteps: Set<number>;
  onStepClick?: (step: NarrativeStep) => void;
}

function CompactView({ steps, highlightedSteps, onStepClick }: CompactViewProps) {
  return (
    <div className="text-sm leading-relaxed space-y-2">
      {steps.map((step, i) => {
        const moveStyle = getMoveTypeStyle(step.moveType);
        const isHighlighted = highlightedSteps.has(step.stepNumber);

        return (
          <span key={step.stepNumber}>
            <span
              onClick={() => onStepClick?.(step)}
              className={cn(
                "inline cursor-pointer hover:underline",
                step.polarity === "+" ? "text-blue-700" : "text-orange-700",
                isHighlighted && "bg-yellow-200 px-1 rounded"
              )}
            >
              <strong>{step.speaker}</strong>
              {" "}
              <span className="text-slate-500">({step.moveType})</span>
              {": "}
              {step.isDaimon ? <em>withdraws</em> : step.content}
            </span>
            {i < steps.length - 1 && " → "}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================================
// CONCLUSION COMPONENT
// ============================================================================

interface ConclusionProps {
  conclusion: JustifiedNarrative["conclusion"];
}

function Conclusion({ conclusion }: ConclusionProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2",
        conclusion.winner === "P"
          ? "bg-blue-50 border-blue-300"
          : conclusion.winner === "O"
          ? "bg-orange-50 border-orange-300"
          : "bg-slate-50 border-slate-300"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">
          {conclusion.winner === "draw" ? "🤝" : conclusion.winner === "P" ? "🏆" : "🎯"}
        </span>
        <span className="font-bold text-lg">
          {conclusion.winner === "draw"
            ? "Draw"
            : `Player ${conclusion.winner} Wins`}
        </span>
      </div>
      <p className="text-slate-700 mb-3">{conclusion.summary}</p>
      {conclusion.keyPoints.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-1">Key Points:</div>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            {conclusion.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProofNarrative({
  narrative: propNarrative,
  interactionId,
  expandable = true,
  defaultExpanded = false,
  highlightedSteps,
  showJustifications = true,
  showAddresses = false,
  style = "cards",
  onStepClick,
  className,
}: ProofNarrativeProps) {
  // Fetch narrative if interactionId provided
  const { data: fetchedData, isLoading } = useSWR(
    interactionId && !propNarrative
      ? `/api/ludics/interactions/${interactionId}/path?format=narrative`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const narrative = propNarrative || (fetchedData?.ok ? fetchedData.narrative : null);

  // Expanded state for each step
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(
    defaultExpanded ? new Set(narrative?.steps.map((s: NarrativeStep) => s.stepNumber) || []) : new Set()
  );

  const highlightedSet = React.useMemo(
    () => new Set(highlightedSteps || []),
    [highlightedSteps]
  );

  // Toggle step expansion
  const toggleStep = (stepNumber: number) => {
    if (!expandable) return;
    const newSet = new Set(expandedSteps);
    if (newSet.has(stepNumber)) {
      newSet.delete(stepNumber);
    } else {
      newSet.add(stepNumber);
    }
    setExpandedSteps(newSet);
  };

  // Expand/collapse all
  const expandAll = () => {
    setExpandedSteps(new Set(narrative?.steps.map((s: NarrativeStep) => s.stepNumber) || []));
  };
  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // Loading
  if (isLoading) {
    return (
      <div className={cn("p-4 text-center text-slate-500", className)}>
        Loading narrative...
      </div>
    );
  }

  // No data
  if (!narrative) {
    return (
      <div className={cn("p-4 text-center text-slate-500", className)}>
        No narrative data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border">
        <div className="flex items-center gap-2">
          <span className="text-xl">📜</span>
          <span className="font-bold">Proof Narrative</span>
          {narrative.title && (
            <span className="text-slate-500">— {narrative.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {narrative.steps.length} steps
          </span>
          {expandable && style === "cards" && (
            <>
              <button
                onClick={expandAll}
                className="text-xs px-2 py-1 border rounded hover:bg-white"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-xs px-2 py-1 border rounded hover:bg-white"
              >
                Collapse All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Style selector */}
      {narrative.metadata?.style && (
        <div className="text-xs text-slate-500">
          Style: {narrative.metadata.style}
        </div>
      )}

      {/* Steps */}
      <div className="border rounded-lg bg-white p-4">
        {style === "cards" && (
          <div className="space-y-3">
            {narrative.steps.map((step: NarrativeStep) => (
              <StepCard
                key={step.stepNumber}
                step={step}
                allSteps={narrative.steps}
                isHighlighted={highlightedSet.has(step.stepNumber)}
                showJustifications={showJustifications}
                showAddresses={showAddresses}
                isExpanded={expandedSteps.has(step.stepNumber)}
                onToggle={() => toggleStep(step.stepNumber)}
                onClick={() => onStepClick?.(step)}
              />
            ))}
          </div>
        )}

        {style === "timeline" && (
          <TimelineView
            steps={narrative.steps}
            highlightedSteps={highlightedSet}
            showJustifications={showJustifications}
            showAddresses={showAddresses}
            onStepClick={onStepClick}
          />
        )}

        {style === "compact" && (
          <CompactView
            steps={narrative.steps}
            highlightedSteps={highlightedSet}
            onStepClick={onStepClick}
          />
        )}
      </div>

      {/* Conclusion */}
      {narrative.conclusion && <Conclusion conclusion={narrative.conclusion} />}

      {/* Metadata */}
      {narrative.metadata?.generatedAt && (
        <div className="text-xs text-slate-400 text-right">
          Generated: {new Date(narrative.metadata.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default ProofNarrative;
