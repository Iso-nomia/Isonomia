/**
 * ContradictionCheckExample Component
 * 
 * Demonstrates how to use the contradiction detection system when creating dialogue moves.
 * 
 * This is a reference implementation showing best practices for integrating
 * real-time contradiction warnings into dialogue move creation.
 * 
 * Usage Pattern:
 * 1. Import the hook and modal
 * 2. Set up the hook in your component
 * 3. Use createMove() instead of raw fetch()
 * 4. Render the ContradictionWarningModal
 * 5. Pass callbacks to handle user actions
 * 
 * Example:
 * ```tsx
 * import { useDialogueMoveWithContradictionCheck } from "@/hooks/useDialogueMoveWithContradictionCheck";
 * import { ContradictionWarningModal } from "@/components/aif/ContradictionWarningModal";
 * 
 * function MyComponent() {
 *   const { createMove, warning, confirmMove, cancelMove, retractAndProceed } = 
 *     useDialogueMoveWithContradictionCheck();
 * 
 *   const handleAssert = async () => {
 *     await createMove({
 *       deliberationId,
 *       targetType: "claim",
 *       targetId: claimId,
 *       kind: "ASSERT",
 *       payload: { expression: "My claim text" }
 *     }, {
 *       onSuccess: () => toast.success("Move created!"),
 *       onError: (err) => toast.error(err)
 *     });
 *   };
 * 
 *   return (
 *     <>
 *       <button onClick={handleAssert}>Assert Claim</button>
 *       
 *       {warning && (
 *         <ContradictionWarningModal
 *           isOpen={!!warning}
 *           newCommitment={warning.newCommitment}
 *           contradictions={warning.contradictions}
 *           onConfirm={confirmMove}
 *           onRetract={retractAndProceed}
 *           onCancel={cancelMove}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */

"use client";
import React, { useState } from "react";
import { useDialogueMoveWithContradictionCheck } from "@/hooks/useDialogueMoveWithContradictionCheck";
import { ContradictionWarningModal } from "@/components/aif/ContradictionWarningModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMicroToast } from "@/hooks/useMicroToast";

interface ContradictionCheckExampleProps {
  deliberationId: string;
  defaultTargetId?: string;
  defaultTargetType?: "claim" | "argument" | "card";
}

export function ContradictionCheckExample({
  deliberationId,
  defaultTargetId = "",
  defaultTargetType = "claim"
}: ContradictionCheckExampleProps) {
  const toast = useMicroToast();
  const [claimText, setClaimText] = useState("");
  const [targetId, setTargetId] = useState(defaultTargetId);
  
  const {
    createMove,
    warning,
    confirmMove,
    cancelMove,
    retractAndProceed,
    isLoading,
  } = useDialogueMoveWithContradictionCheck();

  const handleAssert = async () => {
    if (!claimText.trim()) {
      toast.show("Please enter a claim text", "err");
      return;
    }

    if (!targetId.trim()) {
      toast.show("Please enter a target ID", "err");
      return;
    }

    await createMove(
      {
        deliberationId,
        targetType: defaultTargetType,
        targetId: targetId,
        kind: "ASSERT",
        payload: {
          expression: claimText,
          locusPath: "0",
        },
      },
      {
        onSuccess: () => {
          toast.show("Claim asserted successfully!", "ok");
          setClaimText("");
        },
        onError: (err) => {
          toast.show(`Failed to create move: ${err}`, "err");
        },
      }
    );
  };

  const handleConfirm = async () => {
    await confirmMove(
      () => {
        toast.show("Move created (contradictions bypassed)", "ok");
        setClaimText("");
      },
      (err) => {
        toast.show(`Failed to create move: ${err}`, "err");
      }
    );
  };

  const handleRetract = async (claimId: string) => {
    await retractAndProceed(
      claimId,
      () => {
        toast.show("Previous commitment retracted, new claim asserted", "ok");
        setClaimText("");
      },
      (err) => {
        toast.show(`Failed to retract and proceed: ${err}`, "err");
      }
    );
  };

  return (
    <>
      {toast.node}
      <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Contradiction Check Demo</CardTitle>
        <CardDescription>
          Try asserting claims that contradict your existing commitments.
          The system will warn you before creating contradictory moves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="targetId">Target ID (Claim/Argument ID)</Label>
          <Input
            id="targetId"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="Enter claim or argument ID"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claimText">Claim Text</Label>
          <Input
            id="claimText"
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            placeholder="Enter your claim..."
            disabled={isLoading}
          />
        </div>

        <Button
          onClick={handleAssert}
          disabled={isLoading || !claimText.trim() || !targetId.trim()}
          className="w-full"
        >
          {isLoading ? "Creating..." : "Assert Claim"}
        </Button>

        {/* Example contradictions to try */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs space-y-2">
          <div className="font-semibold text-gray-700">💡 Try these contradictions:</div>
          <ul className="space-y-1 text-gray-600 list-disc list-inside">
            <li>Assert "X is true", then assert "X is false"</li>
            <li>Assert "AI improves productivity", then assert "AI does not improve productivity"</li>
            <li>Assert "Climate change is real", then assert "Climate change is not real"</li>
          </ul>
        </div>

        {/* Contradiction Warning Modal */}
        {warning && (
          <ContradictionWarningModal
            isOpen={!!warning}
            newCommitment={{
              text: warning.newCommitment.text,
              targetId: warning.newCommitment.targetId,
              targetType: warning.newCommitment.targetType as "claim" | "argument",
            }}
            contradictions={warning.contradictions}
            onConfirm={handleConfirm}
            onRetract={handleRetract}
            onCancel={cancelMove}
            isLoading={isLoading}
          />
        )}
      </CardContent>
    </Card>
    </>
  );
}
