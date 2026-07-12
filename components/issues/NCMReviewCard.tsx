// components/issues/NCMReviewCard.tsx
"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, XCircle, User, Calendar, MessageSquare } from "lucide-react";

type MoveType = 
  | "GROUNDS_RESPONSE"
  | "CLARIFICATION_ANSWER"
  | "CHALLENGE_RESPONSE"
  | "EVIDENCE_ADDITION"
  | "PREMISE_DEFENSE"
  | "EXCEPTION_REBUTTAL";

type NCMStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";

type CommunityResponse = {
  id: string;
  targetType: string;
  targetId: string;
  contributorId: string;
  authorId: string;
  moveType: MoveType;
  content: {
    expression: string;
    scheme?: string;
    evidence?: any;
  };
  status: NCMStatus;
  createdAt: string;
  contributor?: {
    id: string;
    username: string;
    image?: string;
  } | null;
};

const MOVE_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  GROUNDS_RESPONSE: { label: "Grounds", color: "bg-green-100 text-green-800", icon: "🛡️" },
  CLARIFICATION_ANSWER: { label: "Clarification", color: "bg-sky-100 text-sky-800", icon: "💬" },
  CHALLENGE_RESPONSE: { label: "Challenge Response", color: "bg-orange-100 text-orange-800", icon: "⚔️" },
  EVIDENCE_ADDITION: { label: "Evidence", color: "bg-purple-100 text-purple-800", icon: "📊" },
  PREMISE_DEFENSE: { label: "Premise Defense", color: "bg-indigo-100 text-indigo-800", icon: "🏛️" },
  EXCEPTION_REBUTTAL: { label: "Exception Rebuttal", color: "bg-red-100 text-red-800", icon: "🔄" },
};

export function NCMReviewCard({
  ncm,
  onApprove,
  onReject,
  isLoading,
}: {
  ncm: CommunityResponse;
  onApprove: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
  isLoading?: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [rejectionNotes, setRejectionNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const moveTypeInfo = MOVE_TYPE_LABELS[ncm.moveType] || {
    label: ncm.moveType,
    color: "bg-slate-100 text-slate-800",
    icon: "📝",
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) return;
    setBusy(true);
    try {
      await onReject(rejectionNotes.trim());
      setShowRejectForm(false);
      setRejectionNotes("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* NCM Info Header */}
      <div className="flex items-start justify-between p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Shield className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900 mb-1">
              Community Defense Response
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={moveTypeInfo.color}>
                {moveTypeInfo.icon} {moveTypeInfo.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {ncm.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {ncm.contributor?.username || "Anonymous"}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(ncm.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NCM Content Preview */}
      <div className="p-4 bg-white rounded-xl border border-slate-200">
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Response Content
        </div>
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {ncm.content.expression}
          </p>
        </div>

        {ncm.content.scheme && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              <span className="font-medium">Argumentation Scheme:</span>{" "}
              {ncm.content.scheme}
            </div>
          </div>
        )}
      </div>

      {/* Review Actions */}
      {ncm.status === "PENDING" && (
        <div className="space-y-3">
          {!showRejectForm ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={busy || isLoading}
                className="
                  flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
                  bg-gradient-to-r from-emerald-500 to-teal-600
                  hover:from-emerald-600 hover:to-teal-700
                  text-white
                  shadow-sm hover:shadow-md
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <CheckCircle2 className="w-4 h-4" />
                {busy ? "Approving..." : "Approve & Execute"}
              </button>

              <button
                onClick={() => setShowRejectForm(true)}
                disabled={busy || isLoading}
                className="
                  px-4 py-3 rounded-lg text-sm font-medium
                  bg-slate-100 hover:bg-slate-200
                  text-slate-700
                  border border-slate-300
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                Reject with Feedback
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm font-medium text-red-900 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Reject with Feedback
              </div>
              <textarea
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm
                  focus:ring-2 focus:ring-red-500 focus:border-red-500
                  placeholder:text-red-400/60"
                rows={3}
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Explain why you're rejecting this response..."
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={busy || !rejectionNotes.trim()}
                  className="
                    px-4 py-2 rounded-lg text-sm font-medium
                    bg-red-600 hover:bg-red-700
                    text-white
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {busy ? "Rejecting..." : "Confirm Rejection"}
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionNotes("");
                  }}
                  disabled={busy}
                  className="
                    px-4 py-2 rounded-lg text-sm font-medium
                    bg-white hover:bg-slate-50
                    text-slate-700
                    border border-slate-300
                    transition-all duration-200
                  "
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Messages */}
      {ncm.status === "APPROVED" && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-green-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            This response has been approved and executed as a canonical move.
          </div>
        </div>
      )}

      {ncm.status === "REJECTED" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-800 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            This response was rejected by the author.
          </div>
        </div>
      )}
    </div>
  );
}
