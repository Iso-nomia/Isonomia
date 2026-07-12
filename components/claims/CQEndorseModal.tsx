//components/claims/CQEndorseModal.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { mutate as globalMutate } from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Award, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type CQEndorseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responseId: string;
  cqStatusId: string;
  onSuccess?: () => void;
};

export default function CQEndorseModal({
  open,
  onOpenChange,
  responseId,
  cqStatusId,
  onSuccess,
}: CQEndorseModalProps) {
  const [comment, setComment] = useState("");
  const [weight, setWeight] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    // Validate
    if (comment.trim().length > 500) {
      setError("Comment must not exceed 500 characters");
      return;
    }

    if (weight < 1 || weight > 10) {
      setError("Weight must be between 1 and 10");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/cqs/responses/${responseId}/endorse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: comment.trim() || undefined,
          weight,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      setSuccess(true);
      
      // Revalidate responses
      await globalMutate(`/api/cqs/responses?cqStatusId=${cqStatusId}`);
      await globalMutate(`/api/cqs/activity?cqStatusId=${cqStatusId}`);

      setTimeout(() => {
        setComment("");
        setWeight(1);
        setSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      console.error("[CQEndorseModal] Submit error:", err);
      setError(err.message || "Failed to submit endorsement. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="!z-[70] max-w-xl bg-white/95 backdrop-blur-xl shadow-2xl p-6 panel-edge"
        overlayClassName="!z-[70]"
      >
      

        {/* Content */}
        <div className="relative z-10">
          <DialogHeader className="mb-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-500/20 to-yellow-500/20 backdrop-blur-sm border border-slate-900/10 shadow-lg">
                <Award className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold text-transparent bg-gradient-to-r from-amber-700 via-yellow-700 to-amber-700 bg-clip-text mb-2">
                  Endorse Response
                </DialogTitle>
                <DialogDescription className="text-slate-600 leading-relaxed">
                  Show your support for this response with an optional comment and
                  weight (1-10)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Weight Selector */}
          <div className="space-y-3 mb-6">
            <Label className="text-sm font-semibold text-sky-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Endorsement Weight
            </Label>
            <p className="text-xs text-slate-600 leading-relaxed">
              Higher weight indicates stronger support (1 = light support, 10 = strong
              support)
            </p>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                <button
                  key={w}
                  onClick={() => setWeight(w)}
                  disabled={submitting || success}
                  className={`
                    flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all
                    ${
                      weight === w
                        ? "border-amber-500 bg-gradient-to-br from-amber-400/20 to-yellow-400/20 text-amber-900 scale-105"
                        : "border-slate-900/10 bg-slate-900/5 text-slate-600 hover:bg-slate-900/10"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-3 mb-6">
            <Label className="text-sm font-semibold text-sky-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              Comment
              <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </Label>
            <div className="relative">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Explain why you're endorsing this response..."
                className="min-h-[120px] resize-y bg-slate-900/5 backdrop-blur-md border-slate-900/20 text-slate-900 placeholder:text-slate-400 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 rounded-xl shadow-lg pr-20"
                disabled={submitting || success}
                maxLength={500}
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded-md backdrop-blur-sm border border-slate-900/10">
                {comment.length} / 500
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-400/15 to-red-400/15 backdrop-blur-md border border-rose-500/40 p-4 shadow-lg mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent" />
              <div className="relative flex gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <p className="text-sm text-rose-900">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400/15 to-green-400/15 backdrop-blur-md border border-emerald-500/40 p-4 shadow-lg mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent" />
              <div className="relative flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 animate-pulse" />
                <p className="text-sm text-emerald-900">
                  Endorsement submitted successfully!
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="bg-slate-900/5 backdrop-blur-md border-slate-900/20 text-slate-900 hover:bg-slate-900/10 hover:border-slate-900/30 transition-all"
            >
              Cancel
            </Button>
            <button
              onClick={handleSubmit}
              disabled={submitting || success}
              className="relative overflow-hidden btnv2 text-sm rounded-xl text-white bg-gradient-to-r from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 border-0 shadow-lg shadow-amber-400/30 hover:shadow-amber-400/50 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Glass shine */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

              <div className="relative flex items-center gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Endorsed!
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    Submit Endorsement
                  </>
                )}
              </div>
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
