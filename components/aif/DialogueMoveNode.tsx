// components/aif/DialogueMoveNode.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  ThumbsUp, 
  ThumbsDown, 
  X, 
  CheckCircle2,
  MessageCircle,
  AlertCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Visual representation of pure dialogue moves (DM-nodes) in AIF graphs.
 * 
 * Dialogue moves represent protocol-level actions that don't create arguments:
 * - WHY: Question/challenge requiring justification
 * - CONCEDE: Acceptance of a claim or argument
 * - RETRACT: Withdrawal of a previous commitment
 * - CLOSE: Termination of discussion thread
 * - ACCEPT_ARGUMENT: Explicit acceptance of reasoning
 * 
 * Design Philosophy:
 * - Distinct visual encoding from RA-nodes (arguments) and I-nodes (claims)
 * - Clear iconography matching dialogue game semantics (Prakken, Reed & Walton)
 * - Compact display suitable for graph visualization contexts
 * - Accessible with ARIA labels and keyboard navigation
 */

export type DialogueMoveKind = 
  | "WHY" 
  | "CONCEDE" 
  | "RETRACT" 
  | "CLOSE" 
  | "ACCEPT_ARGUMENT"
  | "GROUNDS"
  | "ATTACK"
  | "ASSERT";

interface DialogueMoveMetadata {
  speaker?: string;
  speakerName?: string;
  timestamp?: string;
  targetClaimId?: string;
  targetArgumentId?: string;
  replyToMoveId?: string;
}

interface DialogueMoveNodeProps {
  /** Unique identifier for this dialogue move */
  id: string;
  
  /** Type of dialogue move (WHY, CONCEDE, RETRACT, etc.) */
  kind: DialogueMoveKind;
  
  /** Move metadata (speaker, timestamp, target, etc.) */
  metadata?: DialogueMoveMetadata;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Click handler for interactive contexts */
  onClick?: () => void;
  
  /** Display mode: 'badge' (compact) or 'card' (expanded) */
  mode?: "badge" | "card";
  
  /** Show tooltip with metadata */
  showTooltip?: boolean;
}

// ============================================================================
// DESIGN TOKENS - Visual Language for Dialogue Moves
// ============================================================================
const DIALOGUE_MOVE_STYLES = {
  WHY: {
    label: "Challenge",
    icon: HelpCircle,
    color: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
    description: "Why should I accept this?",
    emoji: "❓"
  },
  CONCEDE: {
    label: "Concede",
    icon: ThumbsUp,
    color: "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
    description: "I accept this claim",
    emoji: "✓"
  },
  RETRACT: {
    label: "Retract",
    icon: ThumbsDown,
    color: "bg-red-100 text-red-800 border-red-300 hover:bg-red-200",
    description: "I withdraw this commitment",
    emoji: "✗"
  },
  CLOSE: {
    label: "Close",
    icon: X,
    color: "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200",
    description: "End discussion thread",
    emoji: "⊗"
  },
  ACCEPT_ARGUMENT: {
    label: "Accept",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200",
    description: "I accept this reasoning",
    emoji: "✓✓"
  },
  GROUNDS: {
    label: "Grounds",
    icon: MessageCircle,
    color: "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200",
    description: "Provided justification",
    emoji: "⊢"
  },
  ATTACK: {
    label: "Attack",
    icon: AlertCircle,
    color: "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200",
    description: "Challenged reasoning",
    emoji: "⚔"
  },
  ASSERT: {
    label: "Assert",
    icon: MessageCircle,
    color: "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200",
    description: "Made claim",
    emoji: "⊨"
  }
} as const;

/**
 * DialogueMoveNode Component
 * 
 * Renders a visual representation of a dialogue move with appropriate styling,
 * iconography, and metadata display.
 */
export function DialogueMoveNode({
  id,
  kind,
  metadata,
  className = "",
  onClick,
  mode = "badge",
  showTooltip = true
}: DialogueMoveNodeProps) {
  const style = DIALOGUE_MOVE_STYLES[kind];
  const Icon = style.icon;
  
  // Format timestamp for display
  const formattedTime = metadata?.timestamp 
    ? new Date(metadata.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : null;

  // Build tooltip content
  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-semibold">{style.label}</div>
      <div className="text-gray-300">{style.description}</div>
      {metadata?.speakerName && (
        <div className="text-gray-400">by {metadata.speakerName}</div>
      )}
      {formattedTime && (
        <div className="text-gray-500">{formattedTime}</div>
      )}
    </div>
  );

  // Badge mode: compact display for inline contexts
  if (mode === "badge") {
    const badge = (
      <Badge 
        variant="outline" 
        className={`text-[10px] ${style.color} ${className} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${style.label} dialogue move${metadata?.speakerName ? ` by ${metadata.speakerName}` : ""}`}
      >
        <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
        {style.label}
      </Badge>
    );

    if (showTooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {badge}
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-900 text-white border-gray-800">
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return badge;
  }

  // Card mode: expanded display for dedicated visualization contexts
  return (
    <div 
      className={`
        rounded-lg border-2 p-3 space-y-2
        ${style.color.replace("hover:bg", "hover:border")}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${style.label} dialogue move${metadata?.speakerName ? ` by ${metadata.speakerName}` : ""}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="font-semibold text-sm">{style.label}</span>
        <span className="text-lg ml-auto" aria-hidden="true">{style.emoji}</span>
      </div>
      
      <div className="text-xs text-gray-600 space-y-1">
        {style.description && (
          <div>{style.description}</div>
        )}
        {metadata?.speakerName && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">by</span>
            <span className="font-medium">{metadata.speakerName}</span>
          </div>
        )}
        {formattedTime && (
          <div className="text-gray-500">{formattedTime}</div>
        )}
      </div>
    </div>
  );
}

/**
 * DialogueProvenanceBadge Component
 * 
 * Compact indicator showing that an argument was created via a dialogue move.
 * Used inline with ArgumentCard/ClaimCard to show dialogue provenance.
 */
interface DialogueProvenanceBadgeProps {
  moveId: string;
  moveKind: DialogueMoveKind;
  speakerName?: string;
  className?: string;
  onClick?: () => void;
}

export function DialogueProvenanceBadge({
  moveId,
  moveKind,
  speakerName,
  className = "",
  onClick
}: DialogueProvenanceBadgeProps) {
  const style = DIALOGUE_MOVE_STYLES[moveKind];
  const Icon = style.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`text-[9px] ${style.color} ${className} ${onClick ? "cursor-pointer" : ""}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={`Created via ${style.label}${speakerName ? ` by ${speakerName}` : ""}`}
          >
            <Icon className="h-2.5 w-2.5 mr-1" aria-hidden="true" />
            via {style.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-gray-900 text-white border-gray-800">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Created via {style.label}</div>
            {speakerName && (
              <div className="text-gray-400">by {speakerName}</div>
            )}
            <div className="text-gray-500 text-[10px]">Click to view move</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
