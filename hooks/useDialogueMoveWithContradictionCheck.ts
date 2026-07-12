/**
 * useDialogueMoveWithContradictionCheck Hook
 * 
 * Wraps dialogue move creation with automatic contradiction detection.
 * Shows ContradictionWarningModal when contradictions are detected.
 * 
 * Usage:
 * ```tsx
 * const { createMove, ContradictionModal } = useDialogueMoveWithContradictionCheck();
 * 
 * // In your component:
 * return (
 *   <>
 *     <button onClick={() => createMove({ deliberationId, targetType, targetId, kind, payload })}>
 *       Make Move
 *     </button>
 *     <ContradictionModal />
 *   </>
 * );
 * ```
 */

import { useState, useCallback } from "react";
import type { Contradiction } from "@/lib/aif/dialogue-contradictions";

export interface MoveRequest {
  deliberationId: string;
  targetType: "claim" | "argument" | "card";
  targetId: string;
  kind: "ASSERT" | "WHY" | "GROUNDS" | "RETRACT" | "CONCEDE" | "CLOSE" | "THEREFORE" | "SUPPOSE" | "DISCHARGE" | "ACCEPT_ARGUMENT";
  payload?: any;
  postAs?: {
    targetType: "argument" | "claim" | "card";
    targetId: string;
  };
  autoCompile?: boolean;
  autoStep?: boolean;
  phase?: "focus-P" | "focus-O" | "neutral";
  replyToMoveId?: string;
  replyTarget?: "claim" | "argument" | "premise" | "link" | "presupposition";
}

export interface MoveResponse {
  ok: boolean;
  move?: any;
  step?: any;
  dedup?: boolean;
  contradictionsBypassed?: Contradiction[];
  error?: string;
  contradictions?: Contradiction[];
  newCommitment?: {
    text: string;
    targetId: string;
    targetType: string;
  };
  message?: string;
}

export interface ContradictionWarning {
  request: MoveRequest;
  contradictions: Contradiction[];
  newCommitment: {
    text: string;
    targetId: string;
    targetType: string;
  };
}

export function useDialogueMoveWithContradictionCheck() {
  const [isLoading, setIsLoading] = useState(false);
  const [warning, setWarning] = useState<ContradictionWarning | null>(null);

  /**
   * Create a dialogue move with automatic contradiction detection
   */
  const createMove = useCallback(async (
    request: MoveRequest,
    options?: {
      onSuccess?: (response: MoveResponse) => void;
      onError?: (error: any) => void;
      skipContradictionCheck?: boolean;
    }
  ): Promise<MoveResponse | null> => {
    setIsLoading(true);
    
    try {
      // Add bypassContradictionCheck flag if requested
      const requestWithBypass = options?.skipContradictionCheck
        ? {
            ...request,
            payload: {
              ...request.payload,
              bypassContradictionCheck: true,
            },
          }
        : request;

      const response = await fetch("/api/dialogue/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestWithBypass),
      });

      const data: MoveResponse = await response.json();

      // Check for contradiction warning (409 status)
      if (response.status === 409 && data.error === "CONTRADICTION_DETECTED" && data.contradictions && data.newCommitment) {
        // Show warning modal
        setWarning({
          request,
          contradictions: data.contradictions,
          newCommitment: data.newCommitment,
        });
        setIsLoading(false);
        return null;
      }

      // Handle other errors
      if (!response.ok || !data.ok) {
        options?.onError?.(data.error || "Move creation failed");
        setIsLoading(false);
        return data;
      }

      // Success
      options?.onSuccess?.(data);
      setIsLoading(false);
      return data;
      
    } catch (error) {
      console.error("[useDialogueMoveWithContradictionCheck] Error:", error);
      options?.onError?.(error);
      setIsLoading(false);
      return null;
    }
  }, []);

  /**
   * Confirm and proceed with the move despite contradictions
   */
  const confirmMove = useCallback(async (
    onSuccess?: (response: MoveResponse) => void,
    onError?: (error: any) => void
  ) => {
    if (!warning) return;

    // Retry with bypassContradictionCheck flag
    const result = await createMove(warning.request, {
      onSuccess,
      onError,
      skipContradictionCheck: true,
    });

    // Clear warning after successful move
    if (result?.ok) {
      setWarning(null);
    }
  }, [warning, createMove]);

  /**
   * Cancel the move
   */
  const cancelMove = useCallback(() => {
    setWarning(null);
    setIsLoading(false);
  }, []);

  /**
   * Retract an existing commitment and proceed with the move
   */
  const retractAndProceed = useCallback(async (
    claimId: string,
    onSuccess?: (response: MoveResponse) => void,
    onError?: (error: any) => void
  ) => {
    if (!warning) return;

    setIsLoading(true);

    try {
      // First, create a RETRACT move for the contradicting claim
      const retractResponse = await fetch("/api/dialogue/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliberationId: warning.request.deliberationId,
          targetType: "claim",
          targetId: claimId,
          kind: "RETRACT",
          payload: {},
        }),
      });

      const retractData = await retractResponse.json();

      if (!retractResponse.ok || !retractData.ok) {
        onError?.("Failed to retract existing commitment");
        setIsLoading(false);
        return;
      }

      // Then, proceed with the original move (contradictions should be gone now)
      const result = await createMove(warning.request, {
        onSuccess,
        onError,
        skipContradictionCheck: false, // Check again to be safe
      });

      // Clear warning after successful move
      if (result?.ok) {
        setWarning(null);
      }
      
    } catch (error) {
      console.error("[useDialogueMoveWithContradictionCheck] Retract error:", error);
      onError?.(error);
      setIsLoading(false);
    }
  }, [warning, createMove]);

  return {
    /** Create a dialogue move with automatic contradiction detection */
    createMove,
    
    /** Confirm and proceed with the move despite contradictions */
    confirmMove,
    
    /** Cancel the move */
    cancelMove,
    
    /** Retract an existing commitment and proceed with the move */
    retractAndProceed,
    
    /** Current contradiction warning (if any) */
    warning,
    
    /** Loading state */
    isLoading,
    
    /** Clear the warning */
    clearWarning: cancelMove,
  };
}
