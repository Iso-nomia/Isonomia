/**
 * Action buttons for phase advancement and decision making
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Gavel,
} from "lucide-react";
import { useAdvancePhase, useMakeDecision } from "@/lib/review/hooks";

interface ReviewActionsProps {
  reviewId: string;
  status: string;
  canAdvance: boolean;
  blockers: string[];
}

const decisionOptions = [
  {
    value: "ACCEPT",
    label: "Accept",
    description: "Accept the submission as-is",
    color: "text-green-600",
  },
  {
    value: "MINOR_REVISION",
    label: "Minor Revision",
    description: "Accept pending minor revisions",
    color: "text-blue-600",
  },
  {
    value: "MAJOR_REVISION",
    label: "Major Revision",
    description: "Require major revisions and re-review",
    color: "text-orange-600",
  },
  {
    value: "REJECT",
    label: "Reject",
    description: "Reject the submission",
    color: "text-red-600",
  },
  {
    value: "DESK_REJECT",
    label: "Desk Reject",
    description: "Reject without full review",
    color: "text-red-700",
  },
];

export function ReviewActions({
  reviewId,
  status,
  canAdvance,
  blockers,
}: ReviewActionsProps) {
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionValue, setDecisionValue] = useState<string>("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [advanceNote, setAdvanceNote] = useState("");

  const advancePhase = useAdvancePhase(reviewId);
  const makeDecision = useMakeDecision(reviewId);

  const isCompleted =
    status === "COMPLETED" || status === "WITHDRAWN";
  const canMakeDecision = status === "DECISION" || status === "FINAL_REVIEW";

  const handleAdvance = async () => {
    try {
      await advancePhase.mutateAsync();
      setAdvanceDialogOpen(false);
      setAdvanceNote("");
    } catch (error) {
      console.error("Failed to advance phase:", error);
    }
  };

  const handleDecision = async () => {
    if (!decisionValue || !decisionRationale) return;

    try {
      await makeDecision.mutateAsync({
        decision: decisionValue,
        note: decisionRationale,
      });
      setDecisionDialogOpen(false);
      setDecisionValue("");
      setDecisionRationale("");
    } catch (error) {
      console.error("Failed to make decision:", error);
    }
  };

  if (isCompleted) {
    return null;
  }

  const selectedDecision = decisionOptions.find(
    (d) => d.value === decisionValue
  );

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {blockers.length > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {blockers.length} blocker{blockers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <ul className="text-sm space-y-1">
                      {blockers.map((blocker, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Ready to advance</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canMakeDecision && (
                <Button
                  variant="default"
                  onClick={() => setDecisionDialogOpen(true)}
                >
                  <Gavel className="w-4 h-4 mr-2" />
                  Make Decision
                </Button>
              )}

              <Button
                variant={canAdvance ? "default" : "outline"}
                disabled={!canAdvance}
                onClick={() => setAdvanceDialogOpen(true)}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Advance Phase
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advance Phase Dialog */}
      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance Phase</DialogTitle>
            <DialogDescription>
              Move the review to the next phase. This action will notify all
              participants.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="advance-note">Note (Optional)</Label>
            <Textarea
              id="advance-note"
              placeholder="Add a note about this phase transition..."
              value={advanceNote}
              onChange={(e) => setAdvanceNote(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdvanceDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAdvance} disabled={advancePhase.isPending}>
              {advancePhase.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Make Review Decision</DialogTitle>
            <DialogDescription>
              Render a final decision for this review. This will complete the
              review process and notify all participants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Decision</Label>
              <Select value={decisionValue} onValueChange={setDecisionValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select decision..." />
                </SelectTrigger>
                <SelectContent>
                  {decisionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span className={option.color}>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDecision && (
                <p className="text-xs text-muted-foreground">
                  {selectedDecision.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="decision-rationale">Rationale</Label>
              <Textarea
                id="decision-rationale"
                placeholder="Explain the reasoning behind this decision..."
                value={decisionRationale}
                onChange={(e) => setDecisionRationale(e.target.value)}
                rows={5}
                required
              />
              <p className="text-xs text-muted-foreground">
                This rationale will be shared with all participants
              </p>
            </div>

            {decisionValue && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Decision: </span>
                  <Badge
                    variant="outline"
                    className={selectedDecision?.color}
                  >
                    {selectedDecision?.label}
                  </Badge>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDecisionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDecision}
              disabled={
                !decisionValue ||
                !decisionRationale ||
                makeDecision.isPending
              }
            >
              {makeDecision.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Submit Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
