// components/dialogue/DialogueMoveDetailModal.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { X, User, MessageSquare, ArrowRight, ExternalLink, Clock } from "lucide-react";
import clsx from "clsx";
import { DialogueMoveKind } from "@/components/aif/DialogueMoveNode";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DialogueMoveDetailModalProps {
  moveId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewFullDialogue?: (moveId: string, deliberationId: string) => void;
}

interface DialogueMoveData {
  id: string;
  kind: DialogueMoveKind;
  content: string | null;
  createdAt: string;
  deliberationId: string;
  actor: {
    id: string;
    displayName: string;
    image: string | null;
  } | null;
  deliberation: {
    id: string;
    title: string;
  } | null;
  replyTo: {
    id: string;
    kind: string;
    content: string | null;
    speakerName: string;
  } | null;
  targetClaim: {
    id: string;
    text: string;
  } | null;
  targetArgument: {
    id: string;
    text: string;
  } | null;
  createdArguments: Array<{
    id: string;
    text: string;
    createdAt: string;
  }>;
}

// Move type styling (matches DialogueMoveNode)
const MOVE_STYLES: Record<DialogueMoveKind, { bg: string; border: string; text: string; icon: string }> = {
  WHY: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", icon: "?" },
  CONCEDE: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700", icon: "✓" },
  RETRACT: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", icon: "↶" },
  CLOSE: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700", icon: "■" },
  ACCEPT_ARGUMENT: { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-700", icon: "✓" },
  GROUNDS: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", icon: "⏚" },
  ATTACK: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", icon: "⚔" },
  ASSERT: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700", icon: "!" },
};

/**
 * DialogueMoveDetailModal
 * 
 * Quick-peek modal showing full dialogue move details.
 * Triggered when user clicks DialogueProvenanceBadge on ArgumentCardV2.
 * 
 * Features:
 * - Move metadata (type, speaker, timestamp)
 * - Content/message
 * - Context (reply-to, targets)
 * - Results (created arguments)
 * - "View Full Dialogue" button to navigate to Dialogue tab
 */
export function DialogueMoveDetailModal({
  moveId,
  open,
  onOpenChange,
  onViewFullDialogue,
}: DialogueMoveDetailModalProps) {
  const { data, error, isLoading } = useSWR<DialogueMoveData>(
    moveId && open ? `/api/dialogue-moves/${moveId}` : null,
    fetcher
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-auto bg-white rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Dialogue Move Details</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md hover:bg-slate-200 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">Failed to load dialogue move details.</p>
            </div>
          )}

          {data && (
            <>
              {/* Move Type Badge */}
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold",
                    MOVE_STYLES[data.kind]?.bg || "bg-slate-50",
                    MOVE_STYLES[data.kind]?.border || "border-slate-300",
                    MOVE_STYLES[data.kind]?.text || "text-slate-700"
                  )}
                >
                  <span className="text-lg">{MOVE_STYLES[data.kind]?.icon || "•"}</span>
                  <span>{data.kind}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {new Date(data.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Speaker */}
              {data.actor && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-md">
                  <User className="w-5 h-5 text-slate-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{data.actor.displayName}</p>
                    <p className="text-xs text-slate-500">Speaker</p>
                  </div>
                </div>
              )}

              {/* Content */}
              {data.content && (
                <div className="p-4 bg-slate-50 rounded-md border border-slate-200">
                  <p className="text-sm font-medium text-slate-600 mb-2">Message</p>
                  <p className="text-slate-700">{data.content}</p>
                </div>
              )}

              {/* Context: Reply To */}
              {data.replyTo && (
                <div className="p-4 bg-sky-50 rounded-md border border-sky-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-4 h-4 text-sky-600" />
                    <p className="text-sm font-medium text-sky-700">In Reply To</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-sky-600">
                      {data.replyTo.kind} by {data.replyTo.speakerName}
                    </p>
                    {data.replyTo.content && (
                      <p className="text-sm text-sky-800 italic">&ldquo;{data.replyTo.content}&rdquo;</p>
                    )}
                  </div>
                </div>
              )}

              {/* Target Claim */}
              {data.targetClaim && (
                <div className="p-4 bg-amber-50 rounded-md border border-amber-200">
                  <p className="text-sm font-medium text-amber-700 mb-2">Target Claim</p>
                  <p className="text-sm text-amber-800">{data.targetClaim.text}</p>
                </div>
              )}

              {/* Target Argument */}
              {data.targetArgument && (
                <div className="p-4 bg-purple-50 rounded-md border border-purple-200">
                  <p className="text-sm font-medium text-purple-700 mb-2">Target Argument</p>
                  <p className="text-sm text-purple-800">{data.targetArgument.text}</p>
                </div>
              )}

              {/* Created Arguments */}
              {data.createdArguments.length > 0 && (
                <div className="p-4 bg-green-50 rounded-md border border-green-200">
                  <p className="text-sm font-medium text-green-700 mb-3">
                    Created Arguments ({data.createdArguments.length})
                  </p>
                  <div className="space-y-2">
                    {data.createdArguments.map((arg) => (
                      <div key={arg.id} className="p-2 bg-white rounded border border-green-300">
                        <p className="text-sm text-green-800">{arg.text}</p>
                        <p className="text-xs text-green-600 mt-1">
                          ID: {arg.id.slice(0, 8)}... • {new Date(arg.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliberation Context */}
              {data.deliberation && (
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Deliberation</p>
                  <p className="text-sm font-medium text-slate-700">{data.deliberation.title}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {data && (
          <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Close
            </button>
            {onViewFullDialogue && (
              <button
                onClick={() => {
                  onViewFullDialogue(data.id, data.deliberationId);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                View Full Dialogue
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
