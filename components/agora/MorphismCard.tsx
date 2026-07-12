// components/agora/MorphismCard.tsx
"use client";
import * as React from "react";
import { ArrowRight, Shield, Slash, ThumbsDown, Handshake, HelpCircle } from "lucide-react";

interface MorphismCardProps {
  morphism: {
    id: string;
    fromArgumentId: string;
    toArgumentId: string;
    type: string; // Edge type: support, rebut, undercut, concede, etc.
    confidence: number;
    fromText?: string;
    toText?: string;
    createdAt?: string;
  };
  direction: "incoming" | "outgoing";
  onClick?: () => void;
}

/**
 * MorphismCard
 * 
 * Displays a single morphism (edge) in the argument graph with:
 * - Edge type icon and color-coding
 * - Source/target argument preview
 * - Confidence percentage
 * - Direction indicator
 * 
 * Phase 3.5.2: Morphism Visualization Cards
 */
export function MorphismCard({ morphism, direction, onClick }: MorphismCardProps) {
  // Edge type styling and icons
  const edgeStyles: Record<string, { Icon: any; color: string; label: string }> = {
    support: {
      Icon: Shield,
      color: "text-green-600 bg-green-50 border-green-200",
      label: "Support",
    },
    rebut: {
      Icon: Slash,
      color: "text-red-600 bg-red-50 border-red-200",
      label: "Rebut",
    },
    undercut: {
      Icon: ThumbsDown,
      color: "text-orange-600 bg-orange-50 border-orange-200",
      label: "Undercut",
    },
    concede: {
      Icon: Handshake,
      color: "text-sky-600 bg-sky-50 border-sky-200",
      label: "Concede",
    },
  };

  // Get edge styling (default to generic if type not recognized)
  const edgeStyle = edgeStyles[morphism.type.toLowerCase()] || {
    Icon: HelpCircle,
    color: "text-slate-600 bg-slate-50 border-slate-200",
    label: morphism.type,
  };

  const { Icon, color, label } = edgeStyle;

  // Determine which argument to show based on direction
  const otherArgText =
    direction === "incoming"
      ? morphism.fromText || `Argument ${morphism.fromArgumentId}`
      : morphism.toText || `Argument ${morphism.toArgumentId}`;

  const otherArgId = direction === "incoming" ? morphism.fromArgumentId : morphism.toArgumentId;

  // Confidence color coding
  const confidenceColor = React.useMemo(() => {
    if (morphism.confidence >= 0.7) return "text-green-700 bg-green-100";
    if (morphism.confidence >= 0.4) return "text-amber-700 bg-amber-100";
    return "text-red-700 bg-red-100";
  }, [morphism.confidence]);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${color} transition-all hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Edge Type Icon */}
      <div className="flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </span>
          {direction === "incoming" ? (
            <ArrowRight className="w-3 h-3 text-slate-400" />
          ) : (
            <ArrowRight className="w-3 h-3 text-slate-400 rotate-180" />
          )}
        </div>
        <div className="text-xs text-slate-700 line-clamp-2" title={otherArgText}>
          {direction === "incoming" ? "from" : "to"} <span className="font-medium">&ldquo;{otherArgText}&rdquo;</span>
        </div>
        {morphism.createdAt && (
          <div className="text-[10px] text-slate-500 mt-1">
            {new Date(morphism.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      {/* Confidence Badge */}
      <div className="flex-shrink-0">
        <div
          className={`px-2 py-1 rounded-md text-xs font-semibold ${confidenceColor}`}
          title={`Confidence: ${(morphism.confidence * 100).toFixed(1)}%`}
        >
          {(morphism.confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
