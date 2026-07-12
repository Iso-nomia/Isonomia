"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Lightbulb, MessageSquare, Quote } from "lucide-react";
import type { DraftInventory, ValidationError } from "@/lib/thesis/draft-utils";

interface ThesisPublishConfirmationProps {
  open: boolean;
  onClose: () => void;
  thesisId: string;
  inventory: DraftInventory;
  validationErrors?: ValidationError[];
  onPublishComplete: () => void;
}

export function ThesisPublishConfirmation({
  open,
  onClose,
  thesisId,
  inventory,
  validationErrors = [],
  onPublishComplete,
}: ThesisPublishConfirmationProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasValidationErrors = validationErrors.length > 0;
  const hasObjects = inventory.total > 0;

  const handlePublish = async () => {
    if (hasValidationErrors) return;

    try {
      setIsPublishing(true);
      setError(null);

      const res = await fetch(`/api/thesis/${thesisId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to publish");
      }

      // Success!
      onPublishComplete();
      onClose();
    } catch (err: any) {
      console.error("Publish error:", err);
      setError(err.message || "Failed to publish thesis");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">Publish Thesis</DialogTitle>
          <DialogDescription className="text-slate-600">
            {hasObjects
              ? "The following draft objects will be created as real deliberation objects:"
              : "Your thesis will be published without any draft objects."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation Errors */}
          {hasValidationErrors && (
            <Alert variant="destructive" className="flex gap-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-2">Please fix the following errors before publishing:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{err.type}</span>: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {/* Draft Object Inventory */}
          {hasObjects && (
            <div className="space-y-3">
              {inventory.propositions.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">
                      {inventory.propositions.length} Proposition{inventory.propositions.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                  <p className="text-sm text-purple-700 mb-2">
                    Will be promoted to claims in the deliberation.
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {inventory.propositions.slice(0, 5).map((prop) => (
                      <div key={prop.draftId} className="text-xs text-purple-800 bg-purple-100/50 px-2 py-1 rounded">
                        "{prop.text.slice(0, 80)}{prop.text.length > 80 ? "..." : ""}"
                      </div>
                    ))}
                    {inventory.propositions.length > 5 && (
                      <div className="text-xs text-purple-600 italic pt-1">
                        ...and {inventory.propositions.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {inventory.claims.length > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-teal-600" />
                    <h3 className="font-semibold text-teal-900">
                      {inventory.claims.length} Claim{inventory.claims.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                  <p className="text-sm text-teal-700 mb-2">
                    Will be added to the deliberation.
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {inventory.claims.slice(0, 5).map((claim) => (
                      <div key={claim.draftId} className="flex items-start gap-2 text-xs bg-teal-100/50 px-2 py-1 rounded">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                            claim.position === "IN"
                              ? "bg-emerald-500"
                              : claim.position === "OUT"
                                ? "bg-rose-500"
                                : "bg-slate-400"
                          }`}
                        />
                        <span className="text-teal-800">
                          "{claim.text.slice(0, 80)}{claim.text.length > 80 ? "..." : ""}"
                        </span>
                      </div>
                    ))}
                    {inventory.claims.length > 5 && (
                      <div className="text-xs text-teal-600 italic pt-1">
                        ...and {inventory.claims.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {inventory.arguments.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Quote className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">
                      {inventory.arguments.length} Argument{inventory.arguments.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                  <p className="text-sm text-amber-700 mb-2">
                    Will be created with premises and conclusion.
                  </p>
                  <Alert className="bg-amber-100 border-amber-300 text-amber-800 flex gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      Note: Argument publication is not yet fully implemented. These will be skipped for now.
                    </div>
                  </Alert>
                </div>
              )}

              {/* Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Total Objects to Create:</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {inventory.propositions.length + inventory.claims.length}
                  </span>
                </div>
                {inventory.arguments.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    ({inventory.arguments.length} argument{inventory.arguments.length === 1 ? "" : "s"} will be skipped)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Objects Message */}
          {!hasObjects && (
            <Alert className="bg-sky-50 border-sky-200 flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <div className="text-sky-800">
                Your thesis contains no draft objects. It will be published as-is.
              </div>
            </Alert>
          )}

          {/* API Error */}
          {error && (
            <Alert variant="destructive" className="flex gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </Alert>
          )}

          {/* Warning about publishing */}
          {!hasValidationErrors && (
            <Alert className="bg-slate-50 border-slate-200 flex gap-2">
              <AlertCircle className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5" />
              <div className="text-slate-700 text-sm">
                Once published, your thesis status will change to <strong>PUBLISHED</strong>. Draft objects will become
                permanent deliberation objects that can be referenced by others.
              </div>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isPublishing}>
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || hasValidationErrors}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Publish Thesis
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
