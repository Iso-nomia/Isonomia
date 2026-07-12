// components/arguments/QuickContraryDialog.tsx
"use client";
import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Split, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClaimPicker } from "@/components/claims/ClaimPicker";
import { useContraryCount } from "@/components/claims/contraryBadge/useContraryCount";

interface QuickContraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliberationId: string;
  sourceClaim: {
    id: string;
    text: string;
  };
  /** Current user id (string form). Used to gate the inline Delete button on existing contraries. Server-side authorization still applies. */
  currentUserId?: string | null;
  /** Moderator flag for the host room/deliberation. Allows deleting contraries created by other users. */
  isModerator?: boolean;
  onContraryCreated?: () => void;
}

export function QuickContraryDialog({
  open,
  onOpenChange,
  deliberationId,
  sourceClaim,
  currentUserId = null,
  isModerator = false,
  onContraryCreated
}: QuickContraryDialogProps) {
  const [selectedContrary, setSelectedContrary] = React.useState<{ id: string; text: string } | null>(null);
  const [isSymmetric, setIsSymmetric] = React.useState(true);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [lastCreated, setLastCreated] = React.useState<{
    contraryText: string;
    isSymmetric: boolean;
    reason: string | null;
  } | null>(null);

  // Existing contraries for this source claim (live-refetches on contraries:changed).
  const { items: existingContraries, refetch: refetchExisting, loading: loadingExisting } =
    useContraryCount({ deliberationId, claimId: sourceClaim.id, enabled: open });

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedContrary(null);
      setIsSymmetric(true);
      setReason("");
      setError(null);
      setDeleteError(null);
      setDeletingId(null);
      setLastCreated(null);
    }
  }, [open]);

  const handleDeleteExisting = async (contraryRowId: string) => {
    if (!contraryRowId) return;
    setDeleteError(null);
    setDeletingId(contraryRowId);
    try {
      const res = await fetch(
        `/api/contraries?id=${encodeURIComponent(contraryRowId)}&deliberationId=${encodeURIComponent(deliberationId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete (${res.status})`);
      }
      window.dispatchEvent(
        new CustomEvent("contraries:changed", {
          detail: { deliberationId, claimId: sourceClaim.id },
        })
      );
      refetchExisting();
      onContraryCreated?.(); // reuse parent refresh hook
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete contrary");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateContrary = async () => {
    if (!selectedContrary) {
      setError("Please select a contrary claim");
      return;
    }

    if (selectedContrary.id === sourceClaim.id) {
      setError("A claim cannot be contrary to itself");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/contraries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          claimId: sourceClaim.id,
          contraryId: selectedContrary.id,
          isSymmetric,
          reason: reason.trim() || null
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create contrary");
      }

      // Dispatch event for real-time updates
      window.dispatchEvent(new CustomEvent("contraries:changed", {
        detail: { deliberationId, claimId: sourceClaim.id }
      }));

      // Show inline success state (Task 13: provenance + reason in post-create)
      // Keep dialog open so user can verify and/or create another.
      const createdReason = reason.trim() || null;
      const createdSymmetric = isSymmetric;
      const createdContraryText = selectedContrary.text;
      setLastCreated({
        contraryText: createdContraryText,
        isSymmetric: createdSymmetric,
        reason: createdReason,
      });
      // Reset the form for a follow-up create.
      setSelectedContrary(null);
      setReason("");
      setError(null);

      // Notify parent
      onContraryCreated?.();
    } catch (err) {
      console.error("Failed to create contrary:", err);
      setError(err instanceof Error ? err.message : "Failed to create contrary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-rose-600" />
            Mark Contrary Claim
          </DialogTitle>
          <DialogDescription>
            Define a claim that contradicts or is incompatible with this claim.
            This enables rebutting attacks in ASPIC+.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Claim Display */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              Source Claim:
            </label>
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
              <p className="text-sm text-sky-900">{sourceClaim.text}</p>
            </div>
          </div>

          {/* Existing contraries (Phase D-1: manage in-place) */}
          {(existingContraries.length > 0 || loadingExisting) && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">
                Existing contraries ({existingContraries.length}):
              </label>
              <ul
                className="space-y-1.5 max-h-44 overflow-auto rounded-lg border border-rose-200 bg-rose-50/40 p-2"
                data-testid="quick-contrary-existing-list"
              >
                {existingContraries.map((row) => {
                  const ownerId = row.createdBy?.id != null ? String(row.createdBy.id) : null;
                  const isOwner =
                    !!currentUserId && !!ownerId && String(currentUserId) === ownerId;
                  const canDelete = isOwner || isModerator;
                  const arrow = row.isSymmetric
                    ? "\u2194"
                    : row.direction === "outgoing"
                    ? "\u2192"
                    : "\u2190";
                  return (
                    <li
                      key={row.id}
                      className="flex items-start gap-2 px-2 py-1 rounded bg-white border border-rose-200"
                      data-direction={row.direction}
                      data-symmetric={row.isSymmetric ? "true" : "false"}
                    >
                      <span
                        className="font-mono text-rose-500 text-sm pt-0.5"
                        aria-hidden="true"
                        title={
                          row.isSymmetric
                            ? "symmetric (mutual)"
                            : row.direction === "outgoing"
                            ? "this \u2192 other"
                            : "other \u2192 this"
                        }
                      >
                        {arrow}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-rose-900 break-words">{row.otherText}</p>
                        {(row.createdBy?.username || row.createdBy?.name) && (
                          <p className="text-[10px] text-rose-700/70 mt-0.5">
                            by{" "}
                            <span className="font-medium">
                              @{row.createdBy.username || row.createdBy.name}
                            </span>
                          </p>
                        )}
                        {row.reason && (
                          <p className="text-[10px] text-rose-700/80 italic mt-0.5">
                            &ldquo;{row.reason}&rdquo;
                          </p>
                        )}
                      </div>
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-rose-700 hover:bg-rose-100"
                          disabled={deletingId === row.id}
                          onClick={() => handleDeleteExisting(row.id)}
                          aria-label="Delete contrary"
                          title="Delete contrary"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  );
                })}
                {loadingExisting && existingContraries.length === 0 && (
                  <li className="text-[11px] text-rose-700/70 italic px-1 py-0.5">Loading…</li>
                )}
              </ul>
              {deleteError && (
                <p className="text-[11px] text-red-700">{deleteError}</p>
              )}
            </div>
          )}

          {/* Contrary Claim Picker */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              Select Contrary Claim:
            </label>
            {!selectedContrary ? (
              <Button
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => setPickerOpen(true)}
              >
                <Split className="mr-2 h-4 w-4 text-gray-500" />
                Click to select a contrary claim...
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <p className="text-sm text-rose-900">{selectedContrary.text}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs"
                >
                  Change selection
                </Button>
              </div>
            )}
          </div>

          {/* Symmetric Toggle */}
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <Checkbox
                id="symmetric"
                checked={isSymmetric}
                onCheckedChange={(checked) => setIsSymmetric(checked === true)}
              />
              <div className="flex-1">
                <label
                  htmlFor="symmetric"
                  className="text-sm font-medium text-slate-900 cursor-pointer"
                >
                  Contradictory (Symmetric)
                </label>
                <p className="text-xs text-slate-600 mt-1">
                  {isSymmetric ? (
                    <>
                      <strong>&quot;{sourceClaim.text}&quot;</strong> ↔ <strong>&quot;{selectedContrary?.text || "contrary"}&quot;</strong>
                      <br />
                      Both claims cannot be true (mutual exclusion)
                    </>
                  ) : (
                    <>
                      <strong>&quot;{sourceClaim.text}&quot;</strong> → ¬<strong>&quot;{selectedContrary?.text || "contrary"}&quot;</strong>
                      <br />
                      If source is true, contrary must be false (one-way incompatibility)
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Reason Field (Optional) */}
          <div className="space-y-2">
            <label className="text-xs font-medium  text-gray-700">
              Reason (Optional):
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why these claims are contrary (e.g., 'These claims represent mutually exclusive states')"
              rows={3}
              className="text-sm bg-slate-100"
            />
          </div>

          {/* Well-formedness Info */}
          {selectedContrary && (
            <Alert className="border-sky-500 bg-sky-50">
              <AlertCircle className="h-4 w-4 text-sky-600" />
              <AlertDescription className="text-xs text-sky-800">
                <strong>ASPIC+ Rule:</strong> Arguments with conclusions <strong>&quot;{sourceClaim.text}&quot;</strong> and{" "}
                <strong>&quot;{selectedContrary.text}&quot;</strong> will be able to rebut each other.
                {isSymmetric && " This is a symmetric (contradictory) relationship."}
              </AlertDescription>
            </Alert>
          )}

          {/* Phase D-1: Post-create success banner with provenance + reason */}
          {lastCreated && !selectedContrary && (
            <Alert className="border-emerald-500 bg-emerald-50" data-testid="contrary-create-success">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs text-emerald-900">
                <strong>Created.</strong>{" "}
                <span className="font-mono">
                  {lastCreated.isSymmetric ? "↔" : "→"}
                </span>{" "}
                &ldquo;{lastCreated.contraryText}&rdquo;
                {lastCreated.reason && (
                  <span className="block mt-0.5 italic text-emerald-800/80">
                    Reason: &ldquo;{lastCreated.reason}&rdquo;
                  </span>
                )}
                <span className="block mt-0.5 text-[10px] text-emerald-700/80">
                  You can add another contrary or click Done below.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs text-red-800">
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {lastCreated && !selectedContrary ? "Done" : "Cancel"}
          </Button>
          <Button
            onClick={handleCreateContrary}
            disabled={!selectedContrary || loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? (
              <>Creating...</>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {lastCreated ? "Create Another" : "Create Contrary"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* ClaimPicker Dialog */}
      {pickerOpen && (
        <ClaimPicker
          deliberationId={deliberationId}
          open={pickerOpen}
          onPick={(claim) => {
            // Disallow self-contrary at the UI layer; server still validates.
            if (claim.id !== sourceClaim.id) {
              setSelectedContrary({ id: claim.id, text: claim.text });
            }
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          allowCreate={true}
        />
      )}
    </Dialog>
  );
}
