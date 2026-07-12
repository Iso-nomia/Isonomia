// components/predictions/PredictionSection.tsx
"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import useSWR from "swr";
import { TrendingUp, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PredictionCard } from "./PredictionCard";
import { PredictionCreator } from "./PredictionCreator";
import { OutcomeRecorder } from "./OutcomeRecorder";
import { ResolutionModal } from "./ResolutionModal";
import type { ClaimPrediction } from "@/lib/types/claim-prediction";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PredictionSectionProps {
  claimId: string;
  deliberationId?: string;
  claimText?: string;
  currentUserId?: string;
  canCreate?: boolean;
}

export function PredictionSection({
  claimId,
  deliberationId,
  claimText,
  currentUserId,
  canCreate = true,
}: PredictionSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [recordingOutcomeFor, setRecordingOutcomeFor] = useState<string | null>(null);
  const [resolvingPrediction, setResolvingPrediction] = useState<string | null>(null);

  // Fetch predictions for this claim
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<{ ok: boolean; predictions: ClaimPrediction[]; total: number }>(
    `/api/claims/${claimId}/predictions`,
    fetcher
  );

  const predictions = data?.predictions || [];
  const total = data?.total || 0;

  // Handle prediction creation
  const handleCreatePrediction = useCallback(
    async (predictionData: {
      predictionText: string;
      targetDate?: string;
      confidence: number;
    }) => {
      const response = await fetch(`/api/claims/${claimId}/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(predictionData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create prediction");
      }

      // Refresh the list
      mutate();
      setIsCreating(false);
    },
    [claimId, mutate]
  );

  // Handle prediction delete/withdraw
  const handleDeletePrediction = useCallback(
    async (predictionId: string) => {
      if (!confirm("Are you sure you want to withdraw this prediction?")) return;

      const response = await fetch(`/api/predictions/${predictionId}?soft=true`, {
        method: "DELETE",
      });

      if (response.ok) {
        mutate();
      }
    },
    [mutate]
  );

  // Handle resolve completion
  const handleResolveComplete = useCallback(() => {
    mutate();
    setResolvingPrediction(null);
  }, [mutate]);

  // Handle outcome recorded
  const handleOutcomeRecorded = useCallback(() => {
    mutate();
    setRecordingOutcomeFor(null);
  }, [mutate]);

  // Count by status
  const pendingCount = predictions.filter((p) => p.status === "PENDING").length;
  const resolvedCount = predictions.filter((p) => p.status === "RESOLVED").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Predictions
            {total > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({pendingCount} pending, {resolvedCount} resolved)
              </span>
            )}
          </CardTitle>

          {canCreate && !isCreating && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Prediction
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Creation form */}
        {isCreating && (
          <PredictionCreator
            claimId={claimId}
            claimText={claimText}
            onSubmit={handleCreatePrediction}
            onCancel={() => setIsCreating(false)}
          />
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading predictions...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-8 text-destructive">
            Failed to load predictions. Please try again.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && predictions.length === 0 && !isCreating && (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No predictions yet.</p>
            {canCreate && (
              <p className="text-xs mt-1">
                Make a prediction about this claim&apos;s outcome.
              </p>
            )}
          </div>
        )}

        {/* Predictions list */}
        {predictions.length > 0 && (
          <div className="space-y-3">
            {predictions.map((prediction) => (
              <PredictionCard
                key={prediction.id}
                prediction={prediction}
                currentUserId={currentUserId}
                onUpdate={mutate}
                onResolve={setResolvingPrediction}
                onRecordOutcome={setRecordingOutcomeFor}
                onDelete={handleDeletePrediction}
              />
            ))}
          </div>
        )}

        {/* Outcome recorder modal */}
        {recordingOutcomeFor && (
          <OutcomeRecorder
            predictionId={recordingOutcomeFor}
            isOpen={true}
            onClose={() => setRecordingOutcomeFor(null)}
            onSuccess={handleOutcomeRecorded}
          />
        )}

        {/* Resolution modal */}
        {resolvingPrediction && (
          <ResolutionModal
            predictionId={resolvingPrediction}
            isOpen={true}
            onClose={() => setResolvingPrediction(null)}
            onSuccess={handleResolveComplete}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default PredictionSection;
