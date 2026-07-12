"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CriticalQuestionsV2 from "@/components/claims/CriticalQuestionsV2";

/**
 * ArgumentCriticalQuestionsModal - Modal for displaying and interacting with
 * argument-level critical questions.
 * 
 * This is parallel to the claim-level CQ modal in ArgumentCard, but specifically
 * for argument schemes (expert_opinion, analogy, causal_reasoning, etc.)
 * 
 * Usage:
 * <ArgumentCriticalQuestionsModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   argumentId="arg_123"
 *   deliberationId="delib_456"
 * />
 */

interface ArgumentCriticalQuestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  argumentId: string;
  deliberationId: string;
  roomId?: string;
  currentLens?: string;
  currentAudienceId?: string;
}

export function ArgumentCriticalQuestionsModal({
  open,
  onOpenChange,
  argumentId,
  deliberationId,
  roomId,
  currentLens,
  currentAudienceId,
}: ArgumentCriticalQuestionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Argument Critical Questions</DialogTitle>
          <p className="text-sm text-slate-600 mt-1">
            Critical questions about the reasoning scheme used in this argument
          </p>
        </DialogHeader>
        <CriticalQuestionsV2
          targetType="argument"
          targetId={argumentId}
          deliberationId={deliberationId}
          roomId={roomId}
          currentLens={currentLens}
          currentAudienceId={currentAudienceId}
        />
      </DialogContent>
    </Dialog>
  );
}
