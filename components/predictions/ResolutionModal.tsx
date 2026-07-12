// components/predictions/ResolutionModal.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const RESOLUTION_OPTIONS = [
  {
    value: "CONFIRMED",
    label: "Confirmed",
    description: "The prediction came true",
    icon: CheckCircle2,
    color: "border-green-500 bg-green-50 text-green-700 hover:bg-green-100",
    selectedColor: "border-green-500 bg-green-100 ring-2 ring-green-500",
  },
  {
    value: "DISCONFIRMED",
    label: "Disconfirmed",
    description: "The prediction was wrong",
    icon: XCircle,
    color: "border-red-500 bg-red-50 text-red-700 hover:bg-red-100",
    selectedColor: "border-red-500 bg-red-100 ring-2 ring-red-500",
  },
  {
    value: "PARTIALLY_TRUE",
    label: "Partially True",
    description: "The prediction was partially accurate",
    icon: AlertTriangle,
    color: "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedColor: "border-amber-500 bg-amber-100 ring-2 ring-amber-500",
  },
  {
    value: "INDETERMINATE",
    label: "Indeterminate",
    description: "Cannot be determined",
    icon: HelpCircle,
    color: "border-gray-400 bg-gray-50 text-gray-700 hover:bg-gray-100",
    selectedColor: "border-gray-400 bg-gray-100 ring-2 ring-gray-400",
  },
];

interface ResolutionModalProps {
  predictionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ResolutionModal({
  predictionId,
  isOpen,
  onClose,
  onSuccess,
}: ResolutionModalProps) {
  const [resolution, setResolution] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resolution) {
      setError("Please select an outcome");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/predictions/${predictionId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          resolutionNote: resolutionNote || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resolve prediction");
      }

      // Reset form and close
      setResolution(null);
      setResolutionNote("");
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve prediction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Resolve Prediction
          </DialogTitle>
          <DialogDescription>
            Select the outcome of this prediction based on available evidence.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resolution options */}
          <div className="space-y-2">
            <Label>Outcome</Label>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTION_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = resolution === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setResolution(option.value)}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center",
                      isSelected ? option.selectedColor : option.color
                    )}
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs opacity-75">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution note */}
          <div className="space-y-2">
            <Label htmlFor="resolution-note">Note (optional)</Label>
            <Textarea
              id="resolution-note"
              placeholder="Add context about why this resolution was chosen..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {resolutionNote.length}/2000 characters
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !resolution}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Resolve Prediction
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ResolutionModal;
