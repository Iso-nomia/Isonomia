"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import type { PromoteCommitmentRequest, PromoteCommitmentResponse } from "@/lib/aif/commitment-ludics-types";

interface PromoteToLudicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliberationId: string;
  commitment: {
    participantId: string;
    proposition: string;
    claimId: string;
    claimText: string;
  };
  onSuccess?: (response: PromoteCommitmentResponse) => void;
}

export function PromoteToLudicsModal({
  isOpen,
  onClose,
  deliberationId,
  commitment,
  onSuccess,
}: PromoteToLudicsModalProps) {
  const [isPromoting, setIsPromoting] = useState(false);
  const [targetOwnerId, setTargetOwnerId] = useState<string>("Proponent");
  const [basePolarity, setBasePolarity] = useState<"pos" | "neg">("pos");
  const [targetLocusPath, setTargetLocusPath] = useState<string>("0");

  const handlePromote = async () => {
    setIsPromoting(true);

    try {
      const requestBody: PromoteCommitmentRequest = {
        deliberationId,
        participantId: commitment.participantId,
        proposition: commitment.proposition,
        targetOwnerId,
        basePolarity,
        targetLocusPath: targetLocusPath || undefined,
      };

      const response = await fetch("/api/commitments/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data: PromoteCommitmentResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to promote commitment");
      }

      toast.success("✓ Promoted to Ludics", {
        description: `Commitment promoted as ${basePolarity === "pos" ? "fact" : "rule"} for ${targetOwnerId}`,
        duration: 3000,
      });

      onSuccess?.(data);
      onClose();
    } catch (error) {
      console.error("Error promoting commitment:", error);
      toast.error("Failed to promote commitment", {
        description: error instanceof Error ? error.message : "An error occurred",
        duration: 5000,
      });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px] bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-sky-600" />
            Promote to Ludics System
          </DialogTitle>
          <DialogDescription>
            Convert this dialogue commitment into a formal Ludics commitment element for proof-theoretic reasoning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Commitment Preview */}
          <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
            <p className="text-xs font-semibold text-sky-900 mb-1">Commitment:</p>
            <p className="text-sm text-sky-800">{commitment.claimText}</p>
          </div>

          {/* Target Owner Selection */}
          <div className="space-y-2">
            <Label htmlFor="owner-select">Target Owner</Label>
            <Select value={targetOwnerId} onValueChange={setTargetOwnerId}>
              <SelectTrigger id="owner-select">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Proponent">Proponent</SelectItem>
                <SelectItem value="Opponent">Opponent</SelectItem>
                <SelectItem value="System">System</SelectItem>
                <SelectItem value="Arbiter">Arbiter</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Who owns this commitment in the Ludics system
            </p>
          </div>

          {/* Polarity Selection */}
          <div className="space-y-2">
            <Label>Commitment Type</Label>
            <RadioGroup value={basePolarity} onValueChange={(v) => setBasePolarity(v as "pos" | "neg")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pos" id="polarity-pos" />
                <Label htmlFor="polarity-pos" className="font-normal cursor-pointer">
                  <span className="font-semibold">Fact</span> (positive polarity)
                  <p className="text-xs text-gray-500">A statement that is asserted to be true</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="neg" id="polarity-neg" />
                <Label htmlFor="polarity-neg" className="font-normal cursor-pointer">
                  <span className="font-semibold">Rule</span> (negative polarity)
                  <p className="text-xs text-gray-500">An inference rule or obligation to prove</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Locus Path (Advanced) */}
          <div className="space-y-2">
            <Label htmlFor="locus-path">Locus Path (Optional)</Label>
            <Select value={targetLocusPath} onValueChange={setTargetLocusPath}>
              <SelectTrigger id="locus-path">
                <SelectValue placeholder="Root locus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Root (0)</SelectItem>
                <SelectItem value="0.1">0.1</SelectItem>
                <SelectItem value="0.2">0.2</SelectItem>
                <SelectItem value="0.1.1">0.1.1</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Where in the dialogue tree this commitment should be placed
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPromoting}>
            Cancel
          </Button>
          <Button onClick={handlePromote} disabled={isPromoting} className="bg-sky-600 hover:bg-sky-700">
            {isPromoting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Promoting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Promote to Ludics
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
