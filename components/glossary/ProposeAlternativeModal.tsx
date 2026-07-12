// components/glossary/ProposeAlternativeModal.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

interface ProposeAlternativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  termId: string;
  termName: string;
  onSuccess: () => void;
}

export function ProposeAlternativeModal({ 
  isOpen, 
  onClose, 
  termId, 
  termName,
  onSuccess 
}: ProposeAlternativeModalProps) {
  const { user } = useAuth();
  const [definition, setDefinition] = useState("");
  const [examples, setExamples] = useState("");
  const [sources, setSources] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!definition.trim()) {
      setError("Definition is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/glossary/terms/${termId}/definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: definition.trim(),
          examples: examples.trim() || null,
          sources: sources.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit definition");
      }

      setSuccess(true);
      
      // Dispatch update event
      window.dispatchEvent(new CustomEvent("glossary:updated"));
      
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setDefinition("");
      setExamples("");
      setSources("");
      setError("");
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-slate-900/95 backdrop-blur-xl border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 shadow-lg">
              <Plus className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-white">Propose Alternative Definition</div>
              <div className="text-sm font-normal text-cyan-200/80 mt-0.5">
                {termName}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Info banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 backdrop-blur-md border border-indigo-400/40 p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex gap-3">
            <Lightbulb className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-cyan-100/90 leading-relaxed">
              Propose a competing definition for this term. Community members can endorse definitions they agree with, and the most endorsed definition may become the canonical one.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Definition field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Definition *
              <span className={cn(
                "ml-auto text-xs font-normal px-2 py-0.5 rounded-full backdrop-blur-sm",
                definition.length > 2000 ? "bg-rose-500/30 text-rose-200" : "bg-slate-700/50 text-slate-300"
              )}>
                {definition.length} / 2000
              </span>
            </label>
            <Textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Provide your definition of this term..."
              className="min-h-[120px] bg-slate-800/60 border-white/20 text-white placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-cyan-400/20"
              maxLength={2000}
              disabled={isSubmitting || success}
            />
          </div>

          {/* Examples field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Examples
              <span className="text-xs font-normal text-slate-400">(optional)</span>
              <span className={cn(
                "ml-auto text-xs font-normal px-2 py-0.5 rounded-full backdrop-blur-sm",
                examples.length > 500 ? "bg-rose-500/30 text-rose-200" : "bg-slate-700/50 text-slate-300"
              )}>
                {examples.length} / 500
              </span>
            </label>
            <Textarea
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              placeholder="Provide examples that illustrate this definition..."
              className="min-h-[80px] bg-slate-800/60 border-white/20 text-white placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-cyan-400/20"
              maxLength={500}
              disabled={isSubmitting || success}
            />
          </div>

          {/* Sources field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Sources
              <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <Input
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              placeholder="Links or references that support this definition..."
              className="bg-slate-800/60 border-white/20 text-white placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-cyan-400/20"
              disabled={isSubmitting || success}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Alternative definition submitted successfully!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || success}
              className="flex-1 bg-slate-800/60 border-white/20 text-white hover:bg-slate-700/60 hover:border-white/30"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || success || !definition.trim()}
              className={cn(
                "flex-1 relative overflow-hidden group",
                "bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600",
                "text-white font-semibold shadow-lg disabled:opacity-50"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Submitted!
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Definition
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
