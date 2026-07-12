// components/agora/ClarificationRequestButton.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  HelpCircle, 
  Send, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  MessageCircleQuestion,
} from "lucide-react";
import { LetterRCircle } from "@mynaui/icons-react";

// ============================================================================
// TYPES
// ============================================================================

export interface ClarificationRequestButtonProps {
  deliberationId: string;
  targetType: "argument" | "claim";
  targetId: string;
  targetLabel?: string; // e.g., "Argument: All humans are mortal"
  
  // Appearance
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  
  // Callbacks
  onSuccess?: (clarificationId: string) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ClarificationRequestButton({
  deliberationId,
  targetType,
  targetId,
  targetLabel,
  variant = "outline",
  size = "sm",
  className,
  onSuccess,
  onError,
}: ClarificationRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // ─── Reset on open ──────────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      setQuestion("");
      setSubmitStatus("idle");
      setErrorMessage("");
    }
  }, [open]);

  // ─── Handle Submit ──────────────────────────────────────────
  const handleSubmit = async () => {
    if (!question.trim()) {
      setErrorMessage("Please enter a question");
      return;
    }

    if (question.length > 2000) {
      setErrorMessage("Question must be less than 2000 characters");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/clarification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          targetType,
          targetId,
          question: question.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit clarification request");
      }

      setSubmitStatus("success");
      onSuccess?.(data.clarificationId);

      // Close after a brief success message
      setTimeout(() => {
        setOpen(false);
      }, 1500);
    } catch (error: any) {
      console.error("[ClarificationRequestButton] Submit error:", error);
      setSubmitStatus("error");
      setErrorMessage(error.message || "Failed to submit request");
      onError?.(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button  className="btnv2 bg-indigo-500 text-slate-900 text-xs">
          <LetterRCircle className="w-4 h-4 mr-2" />
          Request Clarification
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl bg-gradient-to-br from-amber-50 to-slate-50">
        <DialogHeader className="space-y-2 pb-4 border-b border-slate-200">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-amber-600" />
            Request Clarification
          </DialogTitle>
          {targetLabel && (
            <p className="text-sm text-slate-600">
              {targetLabel}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Input */}
          <div className="space-y-2">
            <Label htmlFor="question" className="text-sm font-medium text-slate-700">
              What would you like clarified? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ask a specific question about this argument or claim..."
              className="min-h-[100px] resize-y"
              maxLength={2000}
            />
            <p className="text-xs text-slate-500">
              {question.length} / 2000 characters
            </p>
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">How it works</p>
              <ul className="text-amber-800 space-y-1 text-xs list-disc list-inside">
                <li>Your question will be visible to all participants</li>
                <li>The author or community members can provide answers</li>
                <li>Clarifications help strengthen the deliberation</li>
              </ul>
            </div>
          </div>

          {/* Error Display */}
          {submitStatus === "error" && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-900">{errorMessage}</p>
            </div>
          )}

          {/* Success Display */}
          {submitStatus === "success" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-900">
                Clarification request submitted successfully!
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !question.trim() || submitStatus === "success"}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
