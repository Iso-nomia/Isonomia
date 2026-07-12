// components/agora/NonCanonicalResponseForm.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Send, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  HelpCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(192, 194, 222, 0.4);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(218, 228, 239, 0.6);
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface NonCanonicalResponseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Target context
  deliberationId: string;
  targetType: "argument" | "claim" | "clarification_request";
  targetId: string;
  targetMoveId?: string | null;
  
  // Context display (optional)
  targetLabel?: string; // e.g., "Argument: All humans are mortal"
  authorName?: string; // e.g., "Alice"
  
  // Callbacks
  onSuccess?: (ncmId: string) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// MOVE TYPE CONFIGURATIONS
// ============================================================================

type MoveTypeOption = {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MOVE_TYPES: MoveTypeOption[] = [
  {
    value: "GROUNDS_RESPONSE",
    label: "Provide Grounds",
    description: "Offer justification or evidence to support this",
    icon: CheckCircle2,
  },
  {
    value: "CLARIFICATION_ANSWER",
    label: "Answer Clarification",
    description: "Respond to a clarification request",
    icon: HelpCircle,
  },
  {
    value: "CHALLENGE_RESPONSE",
    label: "Respond to Challenge",
    description: "Answer an attack or critical question",
    icon: AlertCircle,
  },
  {
    value: "EVIDENCE_ADDITION",
    label: "Add Evidence",
    description: "Contribute additional supporting evidence",
    icon: CheckCircle2,
  },
  {
    value: "PREMISE_DEFENSE",
    label: "Defend Premise",
    description: "Argue in support of a premise",
    icon: CheckCircle2,
  },
  {
    value: "EXCEPTION_REBUTTAL",
    label: "Rebut Exception",
    description: "Counter an exception or counterexample",
    icon: AlertCircle,
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function NonCanonicalResponseForm({
  open,
  onOpenChange,
  deliberationId,
  targetType,
  targetId,
  targetMoveId,
  targetLabel,
  authorName,
  onSuccess,
  onError,
}: NonCanonicalResponseFormProps) {
  const [moveType, setMoveType] = useState<string>("GROUNDS_RESPONSE");
  const [expression, setExpression] = useState("");
  const [scheme, setScheme] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedMoveType = MOVE_TYPES.find((t) => t.value === moveType);

  // ─── Reset on open ──────────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      setMoveType("GROUNDS_RESPONSE");
      setExpression("");
      setScheme("");
      setSubmitStatus("idle");
      setErrorMessage("");
    }
  }, [open]);

  // ─── Handle Submit ──────────────────────────────────────────
  const handleSubmit = async () => {
    if (!expression.trim()) {
      setErrorMessage("Please provide a response");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/non-canonical/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          targetType,
          targetId,
          targetMoveId,
          moveType,
          content: {
            expression: expression.trim(),
            scheme: scheme.trim() || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit response");
      }

      setSubmitStatus("success");
      onSuccess?.(data.ncmId);

      // Close after a brief success message
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error: any) {
      console.error("[NonCanonicalResponseForm] Submit error:", error);
      setSubmitStatus("error");
      setErrorMessage(error.message || "Failed to submit response");
      onError?.(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <DialogContent className="max-w-3xl max-h-screen overflow-hidden panel-edge-blue 
       bg-slate-900/75 backdrop-blur-xl shadow-2xl px-6 py-8">
        {/* Glass overlay effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/5 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent_50%)] pointer-events-none" />
        
        {/* Water droplet decorations */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-cyan-400/15 rounded-full blur-3xl animate-pulse delay-1000" />
        
        <div className="relative z-10 overflow-y-auto max-h-[85vh] custom-scrollbar px-2">
          <DialogHeader className="space-y-3 pb-3 border-b border-white/10">
            <DialogTitle className="text-3xl font-bold text-white flex items-center gap-3 drop-shadow-lg">
              <div className="p-3 rounded-2xl bg-gradient-to-b from-indigo-500/30 to-cyan-500/30 backdrop-blur-sm border border-white/20 shadow-lg">
                <Users className="w-4 h-4 text-indigo-50 " />
              </div>
              <span className="text-white/80 text-2xl tracking-wide">
                Contribute to the Argument Defense 
              </span>
            </DialogTitle>
         
            {targetLabel && (
              <p className="w-fit ml-1 text-xs border  panel-edge-blue  rounded-lg text-white leading-relaxed px-3 py-1 bg-slate-700/40">
                {targetLabel}
              </p>
            )}
            {authorName && (
              <div className="flex items-center gap-2 pl-1">
                <div className="w-1 h-1 rounded-full bg-cyan-400/60" />
                <p className="text-xs text-cyan-200/80">
                  Your response will be submitted to <span className="font-semibold text-cyan-100">{authorName}</span> for approval
                </p>
              </div>
            )}
          </DialogHeader>

        <div className="space-y-3 py-3">
          {/* ─── Move Type Selector ─────────────────────────────────── */}
          <div className="space-y-3">
            <Label htmlFor="moveType" className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Response Type
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {MOVE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = moveType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setMoveType(type.value)}
                    disabled={isSubmitting}
                    className={cn(
                      "group relative flex flex-col items-start gap-2 p-4 rounded-xl transition-all duration-300",
                      "backdrop-blur-md border shadow-lg overflow-hidden",
                      isSelected
                        ? "border-cyan-400/60 bg-gradient-to-br from-cyan-500/20 to-sky-500/20 shadow-cyan-500/20 scale-[1.02]"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-[1.01]",
                      isSubmitting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {/* Glass shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="relative flex items-center gap-2.5 w-full">
                      <div className={cn(
                        "p-2 rounded-lg transition-all duration-300",
                        isSelected
                          ? "bg-gradient-to-br from-cyan-400/30 to-sky-400/30 shadow-lg shadow-cyan-500/20"
                          : "bg-white/10"
                      )}>
                        <Icon
                          className={cn(
                            "w-4 h-4 transition-colors duration-300",
                            isSelected ? "text-cyan-200" : "text-slate-300"
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold transition-colors duration-300",
                          isSelected ? "text-cyan-50" : "text-slate-200"
                        )}
                      >
                        {type.label}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs leading-relaxed ml-1 transition-colors duration-300 relative",
                      isSelected ? "text-indigo-50/90 " : "text-slate-200/90"
                    )}>
                      {type.description}
                    </span>
                    
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Expression Input ───────────────────────────────────── */}
          <div className="space-y-3">
            <Label htmlFor="expression" className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Your Response
            </Label>
            <div className="relative">
              <Textarea
                id="expression"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                disabled={isSubmitting}
                placeholder={`Provide your ${selectedMoveType?.label.toLowerCase()} here...`}
                className="min-h-[110px] resize-y bg-white/10 backdrop-blur-md  py-3 text-white border-[1px] border-cyan-400/60 placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 rounded-xl shadow-lg"
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md backdrop-blur-sm">
                {expression.length} / 2000
              </div>
            </div>
          </div>

          {/* ─── Scheme Input (Optional) ────────────────────────────── */}
          <div className="space-y-3">
            <Label htmlFor="scheme" className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Argument Scheme <span className="text-slate-400 text-xs font-normal ">(optional)</span>
            </Label>
            <input
              id="scheme"
              type="text"
              value={scheme}
              onChange={(e) => setScheme(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g., Modus Ponens, Argument from Authority, etc."
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm placeholder:text-slate-400 rounded-xl focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 shadow-lg transition-all"
            />
          </div>

          {/* ─── Info Banner ────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 backdrop-blur-md border border-cyan-400/30 py-3 px-3  shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            <div className="relative flex gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-400/30 to-sky-400/30 shadow-lg h-fit">
                <Users className="w-5 h-5 text-cyan-200" />
              </div>
              <div className="text-sm text-indigo-100 flex-1">
                <p className="font-semibold mb-1 text-cyan-50">Community Response</p>
                <p className="text-indigo-200/90 leading-relaxed">
                  Your response will be marked as <strong className="text-cyan-200">pending</strong> until the original author approves it.
                  Other participants can view your contribution, and if approved, it will become an official move in the deliberation.
                </p>
              </div>
            </div>
          </div>

          {/* ─── Error Display ──────────────────────────────────────── */}
          {submitStatus === "error" && errorMessage && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-500/20 to-red-500/20 backdrop-blur-md border border-rose-400/40 p-4 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
              <div className="relative flex gap-3">
                <AlertCircle className="w-5 h-5 text-rose-300 flex-shrink-0" />
                <p className="text-sm text-rose-100">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* ─── Success Display ────────────────────────────────────── */}
          {submitStatus === "success" && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 backdrop-blur-md border border-emerald-400/40 p-4 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
              <div className="relative flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 animate-pulse" />
                <p className="text-sm text-emerald-100">
                  Response submitted successfully! Awaiting author approval.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer Actions ─────────────────────────────────────── */}
        <div className="relative flex items-center justify-between pt-4 mb-3 border-t border-white/10">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="btnv2 rounded-xl bg-slate-300/10 px-3 py-2 backdrop-blur-md border-white/20 text-white text-sm  hover:border-white/30 transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !expression.trim() || submitStatus === "success"}
             className="relative overflow-hidden btnv2 text-sm px-4 py-2.5 rounded-xl text-white
                bg-gradient-to-bl from-sky-800 to-indigo-700 hover:from-sky-800 
                hover:to-indigo-800 border-0 shadow-md shadow-indigo-300/10 
                hover:shadow-indigo-500/50 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
            {/* Glass shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            
            <div className="relative flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Response
                </>
              )}
            </div>
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
