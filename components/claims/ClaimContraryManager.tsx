"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClaimPicker } from "@/components/claims/ClaimPicker";
import { Loader2, Plus, Trash2, AlertCircle, Info, ExternalLink } from "lucide-react";
import { focusAspicForClaim } from "@/components/aspic/focusClaim";

interface Contrary {
  id: string;
  claimId: string;
  contraryId: string;
  isSymmetric: boolean;
  status: string;
  reason?: string | null;
  createdAt: string;
  claim: {
    id: string;
    text: string;
  };
  contrary: {
    id: string;
    text: string;
  };
  createdBy: {
    id: string;
    username: string;
    name?: string | null;
  };
}

interface ClaimContraryManagerProps {
  deliberationId: string;
  claimId: string;
  claimText: string;
  /** Current logged-in user ID; used to gate the delete control to row owners. */
  currentUserId?: string;
  /** Set true if the viewer has moderator/admin powers; allows deleting any row. */
  isModerator?: boolean;
}

export function ClaimContraryManager({
  deliberationId,
  claimId,
  claimText,
  currentUserId,
  isModerator = false,
}: ClaimContraryManagerProps) {
  const [contraries, setContraries] = useState<Contrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedContrary, setSelectedContrary] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [isSymmetric, setIsSymmetric] = useState(true);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load existing contraries
  const loadContraries = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/contraries?deliberationId=${deliberationId}&claimId=${claimId}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load contraries");
      }

      setContraries(data.contraries || []);
    } catch (err: any) {
      setError(err.message || "Failed to load contraries");
      console.error("[ClaimContraryManager] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [claimId, deliberationId]);

  useEffect(() => {
    loadContraries();
  }, [loadContraries]);

  async function createContrary() {
    if (!selectedContrary) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/contraries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          claimId,
          contraryId: selectedContrary.id,
          isSymmetric,
          reason: reason.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to create contrary");
      }

      // Success - reload contraries and close dialog
      await loadContraries();
      setDialogOpen(false);
      setSelectedContrary(null);
      setReason("");
      setIsSymmetric(true);

      // Notify other components
      window.dispatchEvent(
        new CustomEvent("contraries:changed", {
          detail: { deliberationId, claimId },
        })
      );
    } catch (err: any) {
      setError(err.message || "Failed to create contrary");
      console.error("[ClaimContraryManager] Create error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteContrary(contraryId: string) {
    if (!confirm("Remove this contrary relationship?")) return;

    try {
      setError(null);
      const res = await fetch(
        `/api/contraries?deliberationId=${deliberationId}&contraryId=${contraryId}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete contrary");
      }

      // Reload contraries
      await loadContraries();

      // Notify other components
      window.dispatchEvent(
        new CustomEvent("contraries:changed", {
          detail: { deliberationId, claimId },
        })
      );
    } catch (err: any) {
      setError(err.message || "Failed to delete contrary");
      console.error("[ClaimContraryManager] Delete error:", err);
    }
  }

  const activeContraries = contraries.filter((c) => c.status === "ACTIVE");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Contrary Claims
          </h3>
          <div className="text-xs text-gray-500">
            ({activeContraries.length})
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="rounded-lg px-2 py-3 flex items-center gap-2 text-xs"
              onClick={() => {
                setSelectedContrary(null);
                setReason("");
                setIsSymmetric(true);
                setError(null);
              }}
            >
              <Plus className="w-3 h-3" />
              Add Contrary
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-5xl w-full bg-white">
            <DialogHeader>
              <DialogTitle>Add Contrary Relationship</DialogTitle>
              <DialogDescription>
                Specify a claim that contradicts or is contrary to this claim.
                Contraries enable rebutting and undermining attacks in ASPIC+.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Current claim */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-xs font-medium text-blue-700 mb-1">
                  This Claim:
                </div>
                <div className="text-sm text-blue-900">{claimText}</div>
              </div>

              {/* Contrary picker */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Contrary Claim:
                </label>
                <Button
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  className="w-full justify-start text-left h-auto py-2"
                >
                  {selectedContrary ? (
                    <span className="text-sm">{selectedContrary.text}</span>
                  ) : (
                    <span className="text-sm text-gray-500">
                      Select contrary claim...
                    </span>
                  )}
                </Button>
                {selectedContrary && (
                  <div className="mt-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
                    <div className="text-xs font-medium text-rose-700 mb-1">
                      Selected Contrary:
                    </div>
                    <div className="text-sm text-rose-900">
                      {selectedContrary.text}
                    </div>
                  </div>
                )}
              </div>

              {/* ClaimPicker modal */}
              <ClaimPicker
                deliberationId={deliberationId}
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onPick={(claim) => {
                  // Don't allow self-contrary
                  if (claim.id !== claimId) {
                    setSelectedContrary(claim);
                  }
                  setPickerOpen(false);
                }}
                allowCreate={true}
              />

              {/* Symmetric toggle */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSymmetric}
                    onChange={(e) => setIsSymmetric(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      Symmetric (Contradictory)
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      If checked: Both claims contradict each other (φ ↔ ¬φ).
                      <br />
                      If unchecked: Only one-way contrary relationship (φ → ¬ψ).
                    </div>
                  </div>
                </label>
              </div>

              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Reason (Optional):
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why these claims are contraries..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              {/* Well-formedness info */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <strong>Well-formedness check:</strong> You cannot create contraries
                  to claims used as axioms (indisputable premises). The system will
                  validate this automatically.
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={createContrary}
                disabled={!selectedContrary || submitting}
                className="gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Contrary
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error state */}
      {error && !dialogOpen && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Contraries list */}
      {!loading && activeContraries.length === 0 && (
        <div className="text-center py-3 text-sm text-gray-500">
          No contrary relationships defined.
          <br />
          <span className="text-xs">
            Add contraries to enable rebutting and undermining attacks.
          </span>
        </div>
      )}

      {!loading && activeContraries.length > 0 && (
        <div className="space-y-2">
          {activeContraries.map((contrary) => {
            const isOwner =
              !!currentUserId &&
              String(contrary.createdBy?.id) === String(currentUserId);
            const canDelete = isOwner || isModerator;
            const direction: "outgoing" | "incoming" =
              contrary.claimId === claimId ? "outgoing" : "incoming";
            const otherText =
              direction === "outgoing"
                ? contrary.contrary?.text
                : contrary.claim?.text;
            // Arrow & label vary by direction (and by symmetry):
            //   outgoing symmetric: ↔ contradicts
            //   outgoing one-way:   → is contrary to
            //   incoming symmetric: ↔ contradicts (mutual; visually identical)
            //   incoming one-way:   ← contradicted by
            const arrow =
              contrary.isSymmetric
                ? "↔"
                : direction === "outgoing"
                ? "→"
                : "←";
            const directionLabel = contrary.isSymmetric
              ? "Contradictory (symmetric)"
              : direction === "outgoing"
              ? "Contrary (one-way, this → other)"
              : "Contrary (one-way, other → this)";
            return (
            <div
              key={contrary.id}
              className="p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
              data-direction={direction}
            >
              {/* Contrary claim */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="text-sm text-gray-900">
                    {otherText ?? "Unknown claim"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <span className="font-mono">{arrow}</span>
                    <span>{directionLabel}</span>
                  </div>
                </div>

                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteContrary(contrary.id)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                    title={isOwner ? "Remove contrary" : "Remove contrary (moderator)"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Provenance */}
              <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
                <div className="flex items-center gap-1">
                  <span className="font-medium">Created by:</span>
                  <span>
                    {contrary.createdBy.name || contrary.createdBy.username}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">When:</span>
                  <span>
                    {new Date(contrary.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Reason */}
              {contrary.reason && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    Reason:
                  </div>
                  <div className="text-xs text-gray-700 italic">
                    {contrary.reason}
                  </div>
                </div>
              )}

              {/* Phase D-1: jump to ASPIC results focused on this claim */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() =>
                    focusAspicForClaim({ claimId, claimText })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-rose-700 hover:text-rose-900 underline-offset-2 hover:underline"
                  data-testid="contrary-row-view-in-aspic"
                  title="Jump to the ASPIC+ extension view filtered by this claim"
                >
                  View in ASPIC results
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
