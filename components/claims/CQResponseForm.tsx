//components/claims/CQResponseForm.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Send,
  Sparkles,
  ListCheck,
  FileText,
  Link2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  X,
} from "lucide-react";

type CQResponseFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cqStatusId: string;
  cqText: string;
  onSuccess?: () => void;
};

export default function CQResponseForm({
  open,
  onOpenChange,
  cqStatusId,
  cqText,
  onSuccess,
}: CQResponseFormProps) {
  // Form state
  const [groundsText, setGroundsText] = useState("");
  const [evidenceClaimIds, setEvidenceClaimIds] = useState<string[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newEvidenceId, setNewEvidenceId] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddEvidence = () => {
    if (newEvidenceId.trim() && !evidenceClaimIds.includes(newEvidenceId.trim())) {
      setEvidenceClaimIds([...evidenceClaimIds, newEvidenceId.trim()]);
      setNewEvidenceId("");
    }
  };

  const handleRemoveEvidence = (id: string) => {
    setEvidenceClaimIds(evidenceClaimIds.filter((eid) => eid !== id));
  };

  const handleAddSource = () => {
    if (newSourceUrl.trim() && !sourceUrls.includes(newSourceUrl.trim())) {
      setSourceUrls([...sourceUrls, newSourceUrl.trim()]);
      setNewSourceUrl("");
    }
  };

  const handleRemoveSource = (url: string) => {
    setSourceUrls(sourceUrls.filter((u) => u !== url));
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    // Validate
    if (groundsText.trim().length < 10) {
      setError("Response must be at least 10 characters");
      return;
    }

    if (groundsText.trim().length > 5000) {
      setError("Response must not exceed 5000 characters");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/cqs/responses/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cqStatusId,
          groundsText: groundsText.trim(),
          evidenceClaimIds: evidenceClaimIds.length > 0 ? evidenceClaimIds : undefined,
          sourceUrls: sourceUrls.length > 0 ? sourceUrls : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      setSuccess(true);
      setTimeout(() => {
        // Reset form
        setGroundsText("");
        setEvidenceClaimIds([]);
        setSourceUrls([]);
        setNewEvidenceId("");
        setNewSourceUrl("");
        setSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      console.error("[CQResponseForm] Submit error:", err);
      setError(err.message || "Failed to submit response. Please try again.");
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

  const charCount = groundsText.length;
  const isValid = charCount >= 10 && charCount <= 5000;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="!z-[70] max-w-3xl max-h-screen overflow-hidden panel-edge border bg-white/75 backdrop-blur-xl  px-4 py-4"
        overlayClassName="!z-[70]"
      >
      

        {/* Water droplets */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-sky-400/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-cyan-400/8 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />

        {/* Scrollable content */}
        <div className="relative z-10 overflow-y-auto max-h-[85vh] custom-scrollbar px-2 ">
          <DialogHeader className="mb-3">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-b from-sky-500/20 to-cyan-500/20 backdrop-blur-sm border border-slate-900/10 shadow-lg">
                <ListCheck className="w-6 h-6 text-sky-700" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold text-transparent bg-gradient-to-r from-sky-700 via-cyan-700 to-sky-700 bg-clip-text mb-2">
                  Submit Response to Critical Question
                </DialogTitle>
                <DialogDescription className="text-slate-600 leading-relaxed">
                  Provide a well-reasoned answer to address this critical question. Your
                  response will be reviewed before being published.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Critical Question Display */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-400/15 to-cyan-400/15 backdrop-blur-md border border-cyan-500/30 px-4 py-3 shadow-lg mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent" />
            <div className="relative flex gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/30 to-sky-500/30 shadow-lg h-fit">
                <FileText className="w-5 h-5 text-cyan-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1 text-cyan-900 text-sm">
                  Critical Question
                </p>
                <p className="text-sky-800 leading-relaxed text-sm">{cqText}</p>
              </div>
            </div>
          </div>

          {/* Response Text */}
          <div className="space-y-3 mb-4">
            <Label className="text-sm font-semibold text-sky-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              Your Response
             
            </Label>
            <div className="relative">
              <Textarea
                value={groundsText}
                onChange={(e) => setGroundsText(e.target.value)}
                placeholder="Provide a detailed, well-reasoned response (10-5000 characters)..."
                className="min-h-[100px] resize-y bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 rounded-xl articlesearchfield pr-24"
                disabled={submitting || success}
              />
              <div
                className={`absolute bottom-3 right-3 text-xs px-2 py-1 rounded-md backdrop-blur-sm border ${
                  !isValid && charCount > 0
                    ? "text-rose-600 bg-rose-50 border-rose-300"
                    : "text-slate-500 bg-white/80 border-slate-900/10"
                }`}
              >
                {charCount} / 5000
              </div>
            </div>
            {!isValid && charCount > 0 && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {charCount < 10
                  ? `Need ${10 - charCount} more characters`
                  : `Exceeds limit by ${charCount - 5000} characters`}
              </p>
            )}
          </div>

          {/* Evidence Claims */}
          <div className="space-y-3 mb-6">
            <Label className="text-sm font-semibold text-sky-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              Evidence Claims
              <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </Label>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reference existing claims that support your response
            </p>

            {evidenceClaimIds.length > 0 && (
              <div className="space-y-2">
                {evidenceClaimIds.map((id) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/5 border border-slate-900/10"
                  >
                    <FileText className="w-4 h-4 text-sky-700 shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{id}</span>
                    <button
                      onClick={() => handleRemoveEvidence(id)}
                      className="p-1 hover:bg-slate-900/10 rounded-md transition-colors"
                      disabled={submitting || success}
                    >
                      <X className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="text"
                value={newEvidenceId}
                onChange={(e) => setNewEvidenceId(e.target.value)}
                placeholder="Enter claim ID (e.g., claim_abc123)"
                className="flex-1 bg-white border-slate-900/20 text-slate-900 placeholder:text-slate-400 rounded-xl focus:border-cyan-500/60 
                focus:ring-2 focus:ring-cyan-500/20"
                disabled={submitting || success}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddEvidence();
                  }
                }}
              />
              <button
                onClick={handleAddEvidence}
                disabled={!newEvidenceId.trim() || submitting || success}
                className=" px-5 rounded-xl btnv2--ghost bg-white border-slate-900/20 text-slate-900 hover:bg-slate-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Source URLs */}
          <div className="space-y-3 mb-6">
            <Label className="text-sm font-semibold text-sky-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              Source URLs
              <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </Label>
            <p className="text-xs text-slate-600 leading-relaxed">
              Add external sources or references that support your response
            </p>

            {sourceUrls.length > 0 && (
              <div className="space-y-2">
                {sourceUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/5 border border-slate-900/10"
                  >
                    <Link2 className="w-4 h-4 text-sky-700 shrink-0" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-700 flex-1 truncate hover:underline"
                    >
                      {url}
                    </a>
                    <button
                      onClick={() => handleRemoveSource(url)}
                      className="p-1 hover:bg-slate-900/10 rounded-md transition-colors"
                      disabled={submitting || success}
                    >
                      <X className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="https://example.com/source"
                className="flex-1 bg-slate-900/5 backdrop-blur-md border-slate-900/20 text-slate-900 placeholder:text-slate-400 rounded-xl focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
                disabled={submitting || success}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSource();
                  }
                }}
              />
              <button
                onClick={handleAddSource}
                disabled={!newSourceUrl.trim() || submitting || success}
                className=" px-5 rounded-lg btnv2--ghost bg-slate-900/5 backdrop-blur-md border-slate-900/20 text-slate-900 hover:bg-slate-900/10 hover:border-slate-900/30"
              >
                <Plus className="w-4 h-4" />
              </button>
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
                  Response submitted successfully! It will be reviewed shortly.
                </p>
              </div>
            </div>
          )}

        
        </div>
          {/* Footer Actions */}
          <DialogFooter className="gap-2 pt-3 border-t border-slate-900/40">
            <button
             
              onClick={handleClose}
              disabled={submitting}
              className="relative overflow-hidden btnv2  py-2 px-3 text-sm rounded-xl  bg-slate-900/5 backdrop-blur-md border-slate-900/20 text-slate-900 hover:bg-slate-900/10 hover:border-slate-900/30 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || submitting || success}
              className="relative overflow-hidden btnv2 text-sm py-2 px-3 rounded-xl text-white bg-gradient-to-r 
              from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 border-0 shadow-md shadow-cyan-400/30 hover:shadow-cyan-400/50 
              transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Submitted!
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Response
                  </>
                )}
              </div>
            </button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
