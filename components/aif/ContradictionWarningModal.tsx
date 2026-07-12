"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle } from "lucide-react";
import type { Contradiction } from "@/lib/aif/dialogue-contradictions";

/**
 * ContradictionWarningModal Component
 * 
 * Shows a warning when a user attempts to commit to a claim that contradicts
 * their existing commitments in a dialogue.
 * 
 * Features:
 * - Clear display of the contradiction
 * - Explanation of the conflict
 * - Action buttons: Commit Anyway, Retract Existing, Cancel
 * 
 * UX Flow:
 * 1. User creates ASSERT move for claim X
 * 2. System checks if X contradicts existing commitments
 * 3. If contradiction found, modal appears
 * 4. User chooses: proceed anyway, retract contradicting claim, or cancel
 */

export interface ContradictionWarningModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  
  /** The new commitment the user is trying to make */
  newCommitment: {
    text: string;
    targetId: string;
    targetType: "claim" | "argument";
  };
  
  /** List of contradictions detected */
  contradictions: Contradiction[];
  
  /** Callback when user confirms (commits anyway) */
  onConfirm: () => void;
  
  /** Callback when user chooses to retract an existing commitment */
  onRetract: (claimId: string) => void;
  
  /** Callback when user cancels */
  onCancel: () => void;
  
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Renders a single contradiction with details
 */
function ContradictionItem({
  contradiction,
  newCommitmentText,
  onRetract,
}: {
  contradiction: Contradiction;
  newCommitmentText: string;
  onRetract: (claimId: string) => void;
}) {
  // Determine which claim is the existing one (not the new one)
  const existingClaim =
    contradiction.claimA.text === newCommitmentText
      ? contradiction.claimB
      : contradiction.claimA;
  
  // Get contradiction type badge
  const typeBadge = {
    explicit_negation: { label: "Explicit Negation", color: "bg-red-100 text-red-700 border-red-200" },
    semantic_opposition: { label: "Semantic Opposition", color: "bg-orange-100 text-orange-700 border-orange-200" },
    contraries: { label: "Contraries", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  }[contradiction.type];
  
  const confidencePercent = Math.round(contradiction.confidence * 100);
  
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-3">
      {/* Header with type badge */}
      <div className="flex items-center gap-2">
        <Badge className={`text-xs ${typeBadge.color}`}>
          {typeBadge.label}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {confidencePercent}% confidence
        </Badge>
      </div>
      
      {/* Existing commitment */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-gray-600">
          Your existing commitment:
        </div>
        <div className="bg-white border border-red-200 rounded px-3 py-2 text-sm">
          "{existingClaim.text}"
        </div>
      </div>
      
      {/* Explanation */}
      <div className="text-xs text-gray-700 bg-white/50 rounded px-3 py-2 border border-red-100">
        <span className="font-semibold">Why this is a contradiction:</span>
        <br />
        {contradiction.reason}
      </div>
      
      {/* Retract button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
        onClick={() => onRetract(existingClaim.id)}
      >
        <XCircle className="h-3 w-3 mr-1" />
        Retract "{existingClaim.text.slice(0, 40)}..."
      </Button>
    </div>
  );
}

export function ContradictionWarningModal({
  isOpen,
  newCommitment,
  contradictions,
  onConfirm,
  onRetract,
  onCancel,
  isLoading = false,
}: ContradictionWarningModalProps) {
  const contradictionCount = contradictions.length;
  const hasMultipleContradictions = contradictionCount > 1;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>
              ⚠️ Warning: Potential Contradiction
              {hasMultipleContradictions && ` (${contradictionCount})`}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            The claim you're trying to assert contradicts{" "}
            {hasMultipleContradictions 
              ? `${contradictionCount} of your existing commitments` 
              : "one of your existing commitments"}.
          </DialogDescription>
        </DialogHeader>
        
        {/* New commitment preview */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold text-gray-600">
            New commitment you're trying to make:
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded px-3 py-2 text-sm">
            "{newCommitment.text}"
          </div>
        </div>
        
        {/* Contradictions list */}
        <div className="space-y-3 pt-2">
          {contradictions.map((contradiction, idx) => (
            <ContradictionItem
              key={`${contradiction.claimA.id}-${contradiction.claimB.id}-${idx}`}
              contradiction={contradiction}
              newCommitmentText={newCommitment.text}
              onRetract={onRetract}
            />
          ))}
        </div>
        
        {/* Action buttons */}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoading ? "Committing..." : "Commit Anyway"}
          </Button>
        </DialogFooter>
        
        {/* Disclaimer */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          <strong>Note:</strong> Committing to contradictory claims may weaken your
          dialectical position. Consider retracting the existing commitment or
          revising your new claim.
        </div>
      </DialogContent>
    </Dialog>
  );
}
