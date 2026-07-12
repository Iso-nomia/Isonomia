// components/predictions/OutcomeRecorder.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { FileText, Link2, Calendar, Loader2, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EVIDENCE_TYPES = [
  { value: "OBSERVATION", label: "Direct Observation" },
  { value: "MEASUREMENT", label: "Measurement / Data" },
  { value: "ANNOUNCEMENT", label: "Official Announcement" },
  { value: "NEWS_REPORT", label: "News Report" },
  { value: "STUDY", label: "Research Study" },
  { value: "OTHER", label: "Other" },
];

interface OutcomeRecorderProps {
  predictionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OutcomeRecorder({
  predictionId,
  isOpen,
  onClose,
  onSuccess,
}: OutcomeRecorderProps) {
  const [description, setDescription] = useState("");
  const [evidenceType, setEvidenceType] = useState("OBSERVATION");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [observedAt, setObservedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (description.length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/predictions/${predictionId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          evidenceType,
          evidenceUrl: evidenceUrl || undefined,
          observedAt: observedAt ? new Date(observedAt).toISOString() : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record outcome");
      }

      // Reset form and close
      setDescription("");
      setEvidenceType("OBSERVATION");
      setEvidenceUrl("");
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record outcome");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Record Outcome
          </DialogTitle>
          <DialogDescription>
            Document evidence or an observation relevant to this prediction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="outcome-description">Description</Label>
            <Textarea
              id="outcome-description"
              placeholder="Describe what was observed or discovered..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/2000 characters (minimum 10)
            </p>
          </div>

          {/* Evidence type */}
          <div className="space-y-2">
            <Label htmlFor="evidence-type">Evidence Type</Label>
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger id="evidence-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Evidence URL */}
          <div className="space-y-2">
            <Label htmlFor="evidence-url" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Source URL (optional)
            </Label>
            <Input
              id="evidence-url"
              type="url"
              placeholder="https://..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
          </div>

          {/* Observed date */}
          <div className="space-y-2">
            <Label htmlFor="observed-at" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date Observed
            </Label>
            <Input
              id="observed-at"
              type="date"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
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
            <Button
              type="submit"
              disabled={isSubmitting || description.length < 10}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Record Outcome
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default OutcomeRecorder;
