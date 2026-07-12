// components/predictions/PredictionCreator.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { TrendingUp, Calendar, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface PredictionCreatorProps {
  claimId: string;
  claimText?: string;
  onSubmit?: (prediction: {
    predictionText: string;
    targetDate?: string;
    confidence: number;
  }) => Promise<void>;
  onCancel?: () => void;
  isOpen?: boolean;
}

export function PredictionCreator({
  claimId,
  claimText,
  onSubmit,
  onCancel,
  isOpen = true,
}: PredictionCreatorProps) {
  const [predictionText, setPredictionText] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (predictionText.length < 10) {
      setError("Prediction must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          predictionText,
          targetDate: targetDate || undefined,
          confidence: confidence / 100,
        });
      } else {
        // Default API call
        const response = await fetch(`/api/claims/${claimId}/predictions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            predictionText,
            targetDate: targetDate || undefined,
            confidence: confidence / 100,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create prediction");
        }
      }

      // Reset form
      setPredictionText("");
      setTargetDate("");
      setConfidence(50);
      onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create prediction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get confidence label
  const getConfidenceLabel = (value: number) => {
    if (value <= 20) return "Very Low";
    if (value <= 40) return "Low";
    if (value <= 60) return "Moderate";
    if (value <= 80) return "High";
    return "Very High";
  };

  // Get confidence color
  const getConfidenceColor = (value: number) => {
    if (value <= 20) return "text-red-600";
    if (value <= 40) return "text-orange-600";
    if (value <= 60) return "text-yellow-600";
    if (value <= 80) return "text-lime-600";
    return "text-green-600";
  };

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Make a Prediction
          </CardTitle>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {claimText && (
          <p className="text-xs text-muted-foreground mt-1">
            About: &quot;{claimText.substring(0, 100)}
            {claimText.length > 100 ? "..." : ""}&quot;
          </p>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prediction text */}
          <div className="space-y-2">
            <Label htmlFor="prediction-text">Your Prediction</Label>
            <Textarea
              id="prediction-text"
              placeholder="I predict that this claim will be confirmed when..."
              value={predictionText}
              onChange={(e) => setPredictionText(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {predictionText.length}/500 characters (minimum 10)
            </p>
          </div>

          {/* Target date */}
          <div className="space-y-2">
            <Label htmlFor="target-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Target Date (optional)
            </Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs text-muted-foreground">
              When do you expect this prediction to be resolved?
            </p>
          </div>

          {/* Confidence slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Confidence Level
              </Label>
              <span className={cn("text-sm font-medium", getConfidenceColor(confidence))}>
                {confidence}% - {getConfidenceLabel(confidence)}
              </span>
            </div>
            <Slider
              value={[confidence]}
              onValueChange={(values) => setConfidence(values[0])}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Very Low</span>
              <span>Moderate</span>
              <span>Very High</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || predictionText.length < 10}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Create Prediction
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default PredictionCreator;
