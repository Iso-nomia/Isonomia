// lib/tiptap/extensions/argument-node.tsx
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Shield, 
  Swords, 
  AlertTriangle, 
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  FileText
} from "lucide-react";
import { LiveBadgeStrip } from "@/lib/thesis/LiveBadgeStrip";
import { useOpenInspector } from "@/lib/thesis/ThesisLiveContext";

// React component for rendering the argument
function ArgumentNodeView({ node }: NodeViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const openInspector = useOpenInspector();
  
  const { 
    argumentId, 
    text, 
    scheme, 
    role, 
    authorName,
    premises,
    implicitWarrant,
    cq,
    attacks,
    preferences
  } = node.attrs as {
    argumentId: string;
    text: string;
    scheme?: string;
    role?: "PREMISE" | "OBJECTION" | "REBUTTAL";
    authorName?: string;
    premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
    implicitWarrant?: { text?: string };
    cq?: { required: number; satisfied: number };
    attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number };
    preferences?: { preferredBy: number; dispreferredBy: number };
  };

  const roleConfig = {
    PREMISE: {
      icon: Shield,
      color: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-200",
      accentBorder: "border-l-sky-400",
      label: "Supporting",
    },
    OBJECTION: {
      icon: Swords,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200",
      accentBorder: "border-l-rose-400",
      label: "Objection",
    },
    REBUTTAL: {
      icon: Shield,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
      accentBorder: "border-l-purple-400",
      label: "Rebuttal",
    },
  };

  const config = role ? roleConfig[role] : roleConfig.PREMISE;
  const Icon = config.icon;

  // Calculate CQ percentage
  const cqRequired = cq?.required ?? 0;
  const cqSatisfied = cq?.satisfied ?? 0;
  const cqPct = cqRequired ? Math.round((cqSatisfied / cqRequired) * 100) : 100;
  
  const cqColorClass =
    cqPct === 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    cqPct >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' :
    'bg-rose-50 border-rose-200 text-rose-700';
  
  const CqIcon = cqPct === 100 ? CheckCircle2 : AlertTriangle;

  const hasDetails = (premises && premises.length > 0) || 
                     implicitWarrant?.text || 
                     (attacks && (attacks.REBUTS > 0 || attacks.UNDERCUTS > 0 || attacks.UNDERMINES > 0)) ||
                     (preferences && (preferences.preferredBy > 0 || preferences.dispreferredBy > 0));

  return (
    <NodeViewWrapper
      as="div"
      className="argument-embed not-prose my-4"
      data-argument-id={argumentId}
    >
      <div
        className={`rounded-lg border-2 ${config.border} border-l-4 ${config.accentBorder} ${config.bg} shadow-sm hover:shadow-md transition-all duration-200`}
      >
        {/* Header: Conclusion + Metadata */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                role === "PREMISE"
                  ? "bg-sky-100 text-sky-700"
                  : role === "OBJECTION"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-purple-100 text-purple-700"
              }`}>
                {config.label}
              </span>
              {scheme && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-700 font-medium">
                  {scheme}
                </span>
              )}
            </div>
            
            {/* CQ Health Indicator */}
            {cqRequired > 0 && (
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cqColorClass}`}
                title={`${cqSatisfied}/${cqRequired} Critical Questions satisfied`}
              >
                <CqIcon className="w-3 h-3" />
                CQ {cqPct}%
              </div>
            )}
          </div>

          {/* Conclusion (Primary) */}
          <div className="mb-2">
            <p
              className="text-base font-semibold text-slate-900 leading-relaxed cursor-pointer hover:underline decoration-dotted"
              role="button"
              tabIndex={0}
              onClick={() =>
                argumentId &&
                openInspector({ kind: "argument", id: argumentId, tab: "overview" })
              }
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && argumentId) {
                  e.preventDefault();
                  openInspector({ kind: "argument", id: argumentId, tab: "overview" });
                }
              }}
            >
              {text}
            </p>
          </div>

          {/* Live badges (label, attacks, evidence, CQ, freshness) */}
          <div className="mb-2">
            <LiveBadgeStrip id={argumentId} kind="argument" />
          </div>

          {/* Expand/Collapse Toggle */}
          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium mt-2 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  Show reasoning & evidence
                </>
              )}
            </button>
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && hasDetails && (
          <div className="border-t border-slate-200 bg-white/50 p-4 space-y-3">
            {/* Premises */}
            {premises && premises.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Based on:
                </div>
                <ul className="space-y-1.5">
                  {premises.map((p, idx) => (
                    <li
                      key={p.id}
                      className={`text-sm text-slate-700 flex items-start gap-2 px-3 py-2 rounded-md ${
                        p.isImplicit 
                          ? 'bg-amber-50/50 border border-amber-200 italic' 
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span className="text-slate-400 font-medium flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="flex-1">{p.text}</span>
                      {p.isImplicit && (
                        <span className="text-xs text-amber-600 flex-shrink-0">implicit</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Implicit Warrant */}
            {implicitWarrant?.text && (
              <div className="px-3 py-2 rounded-md bg-orange-50/50 border border-orange-200">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-orange-900 mb-1">
                      Warrant:
                    </div>
                    <div className="text-sm text-orange-800">
                      {implicitWarrant.text}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attacks & Preferences */}
            {((attacks && (attacks.REBUTS > 0 || attacks.UNDERCUTS > 0 || attacks.UNDERMINES > 0)) ||
              (preferences && (preferences.preferredBy > 0 || preferences.dispreferredBy > 0))) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                {/* Attack Counts */}
                {attacks && attacks.REBUTS > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {attacks.REBUTS} Rebut{attacks.REBUTS !== 1 ? 's' : ''}
                  </span>
                )}
                {attacks && attacks.UNDERCUTS > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                    {attacks.UNDERCUTS} Undercut{attacks.UNDERCUTS !== 1 ? 's' : ''}
                  </span>
                )}
                {attacks && attacks.UNDERMINES > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
                    {attacks.UNDERMINES} Undermine{attacks.UNDERMINES !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Preference Counts */}
                {preferences && preferences.preferredBy > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                    <ArrowUp className="w-3 h-3" />
                    {preferences.preferredBy}
                  </span>
                )}
                {preferences && preferences.dispreferredBy > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    <ArrowDown className="w-3 h-3" />
                    {preferences.dispreferredBy}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// TipTap extension definition
export const ArgumentNode = Node.create({
  name: "argumentNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      argumentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-argument-id"),
        renderHTML: (attributes) => ({
          "data-argument-id": attributes.argumentId,
        }),
      },
      text: {
        default: "",
      },
      scheme: {
        default: null,
      },
      role: {
        default: null,
      },
      authorName: {
        default: null,
      },
      premises: {
        default: null,
      },
      implicitWarrant: {
        default: null,
      },
      cq: {
        default: null,
      },
      attacks: {
        default: null,
      },
      preferences: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="argument-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "argument-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArgumentNodeView);
  },
});
