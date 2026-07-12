// components/assumptions/AssumptionCard.tsx
"use client";
import * as React from "react";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

type AssumptionStatus = "PROPOSED" | "ACCEPTED" | "RETRACTED" | "CHALLENGED";

interface AssumptionCardProps {
  id: string;
  assumptionText?: string | null;
  assumptionClaimId?: string | null;
  claimText?: string | null;
  role: string;
  status: AssumptionStatus;
  statusChangedAt?: Date | string;
  statusChangedBy?: string | null;
  challengeReason?: string | null;
  weight?: number | null;
  confidence?: number | null;
  onStatusChange?: () => void;
}

/**
 * Card displaying an assumption with status badge and lifecycle actions.
 * Phase 2.4: Assumption lifecycle tracking.
 */
export function AssumptionCard({
  id,
  assumptionText,
  assumptionClaimId,
  claimText,
  role,
  status,
  statusChangedAt,
  statusChangedBy,
  challengeReason,
  weight,
  confidence,
  onStatusChange,
}: AssumptionCardProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showChallengeForm, setShowChallengeForm] = React.useState(false);
  const [challengeReasonInput, setChallengeReasonInput] = React.useState("");

  const displayText = claimText || assumptionText || "No text provided";

  const getStatusBadge = (status: AssumptionStatus) => {
    switch (status) {
      case "PROPOSED":
        return {
          icon: Clock,
          color: "amber",
          bg: "bg-amber-50",
          border: "border-amber-300",
          text: "text-amber-700",
          label: "Proposed",
        };
      case "ACCEPTED":
        return {
          icon: CheckCircle2,
          color: "green",
          bg: "bg-green-50",
          border: "border-green-300",
          text: "text-green-700",
          label: "Accepted",
        };
      case "RETRACTED":
        return {
          icon: XCircle,
          color: "gray",
          bg: "bg-slate-50",
          border: "border-slate-300",
          text: "text-slate-700",
          label: "Retracted",
        };
      case "CHALLENGED":
        return {
          icon: AlertCircle,
          color: "red",
          bg: "bg-red-50",
          border: "border-red-300",
          text: "text-red-700",
          label: "Challenged",
        };
    }
  };

  const badge = getStatusBadge(status);
  const StatusIcon = badge.icon;

  const handleAction = async (action: "accept" | "retract" | "challenge") => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = `/api/assumptions/${id}/${action}`;
      const body =
        action === "challenge" && challengeReasonInput
          ? { reason: challengeReasonInput }
          : undefined;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} assumption`);
      }

      onStatusChange?.();
      setShowChallengeForm(false);
      setChallengeReasonInput("");
    } catch (err: any) {
      setError(err.message || `Failed to ${action} assumption`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {role}
            </span>
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${badge.bg} border ${badge.border}`}
            >
              <StatusIcon className={`w-3 h-3 ${badge.text}`} />
              <span className={`text-xs font-medium ${badge.text}`}>
                {badge.label}
              </span>
            </div>
          </div>

          <div className="text-sm text-slate-900 leading-relaxed">
            {displayText}
          </div>

          {/* Phase A: ASPIC+ Metadata */}
          {(weight !== null || confidence !== null) && (
            <div className="flex items-center gap-3 mt-2">
              {weight !== null && weight !== undefined && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200">
                  <span className="text-[10px] font-medium text-indigo-700">WEIGHT</span>
                  <span className="text-xs font-semibold text-indigo-900">{(weight * 100).toFixed(0)}%</span>
                </div>
              )}
              {confidence !== null && confidence !== undefined && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-50 border border-purple-200">
                  <span className="text-[10px] font-medium text-purple-700">CONFIDENCE</span>
                  <span className="text-xs font-semibold text-purple-900">{(confidence * 100).toFixed(0)}%</span>
                </div>
              )}
              {status === "ACCEPTED" && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-900">K_a</span>
                  <span className="text-[10px] text-amber-700">Weak Premise</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Challenge Reason */}
      {status === "CHALLENGED" && challengeReason && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Challenge Reason:</strong> {challengeReason}
        </div>
      )}

      {/* Actions */}
      {status !== "RETRACTED" && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {status === "PROPOSED" && (
            <>
              <button
                onClick={() => handleAction("accept")}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => setShowChallengeForm(true)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Challenge
              </button>
            </>
          )}

          {status === "ACCEPTED" && (
            <>
              <button
                onClick={() => setShowChallengeForm(true)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Challenge
              </button>
            </>
          )}

          {status === "CHALLENGED" && (
            <>
              <button
                onClick={() => handleAction("accept")}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resolve & Accept
              </button>
            </>
          )}

          <button
            onClick={() => handleAction("retract")}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Retract
          </button>
        </div>
      )}

      {/* Challenge Form */}
      {showChallengeForm && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Reason for Challenge (optional)
          </label>
          <textarea
            value={challengeReasonInput}
            onChange={(e) => setChallengeReasonInput(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
            placeholder="Explain why this assumption is problematic..."
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction("challenge")}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Challenge
            </button>
            <button
              onClick={() => {
                setShowChallengeForm(false);
                setChallengeReasonInput("");
              }}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Timeline Info */}
      {statusChangedAt && (
        <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
          Status changed{" "}
          {new Date(statusChangedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {statusChangedBy && ` by user ${statusChangedBy}`}
        </div>
      )}
    </div>
  );
}
