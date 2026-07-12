/**
 * Main dashboard for a peer review deliberation
 */

"use client";

import React from "react";
import {
  useReview,
  useReviewProgress,
  useReviewerAssignments,
  useReviewCommitments,
} from "@/lib/review/hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PhaseTimeline } from "./PhaseTimeline";
import { ReviewerPanel } from "./ReviewerPanel";
import { CommitmentPanel } from "./CommitmentPanel";
import { ReviewActions } from "./ReviewActions";

interface ReviewDashboardProps {
  reviewId: string;
}

const statusColors: Record<string, string> = {
  INITIATED: "bg-gray-500",
  IN_REVIEW: "bg-blue-500",
  AUTHOR_RESPONSE: "bg-yellow-500",
  REVISION: "bg-orange-500",
  FINAL_REVIEW: "bg-purple-500",
  DECISION: "bg-indigo-500",
  COMPLETED: "bg-green-500",
  WITHDRAWN: "bg-red-500",
};

const decisionLabels: Record<string, { label: string; color: string }> = {
  ACCEPT: { label: "Accepted", color: "text-green-600" },
  MINOR_REVISION: { label: "Minor Revisions", color: "text-blue-600" },
  MAJOR_REVISION: { label: "Major Revisions", color: "text-orange-600" },
  REJECT: { label: "Rejected", color: "text-red-600" },
  DESK_REJECT: { label: "Desk Rejected", color: "text-red-700" },
};

export function ReviewDashboard({ reviewId }: ReviewDashboardProps) {
  const { data: review, isLoading: reviewLoading } = useReview(reviewId);
  const { data: progress, isLoading: progressLoading } =
    useReviewProgress(reviewId);
  const { data: assignments } = useReviewerAssignments(reviewId);
  const { data: commitments } = useReviewCommitments(reviewId, {
    onlyUnresolved: true,
  });

  if (reviewLoading || progressLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Review not found
      </div>
    );
  }

  const completedPhases =
    progress?.phases.filter((p) => p.status === "COMPLETED").length || 0;
  const totalPhases = progress?.phases.length || 1;
  const phaseProgress = (completedPhases / totalPhases) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{review.targetTitle}</h1>
            <Badge className={statusColors[review.status]}>
              {review.status.replace(/_/g, " ")}
            </Badge>
          </div>
          {review.targetSource && (
            <p className="text-muted-foreground">
              Authors: {review.targetSource.authors.join(", ")}
            </p>
          )}
        </div>

        {review.decision && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Decision</p>
            <p
              className={`text-xl font-semibold ${
                decisionLabels[review.decision]?.color
              }`}
            >
              {decisionLabels[review.decision]?.label}
            </p>
          </div>
        )}
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Review Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  Phase {completedPhases} of {totalPhases}
                </span>
                <span>{Math.round(phaseProgress)}%</span>
              </div>
              <Progress value={phaseProgress} />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {assignments?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Reviewers</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {progress?.totals?.openConcerns || 0}
                </p>
                <p className="text-sm text-muted-foreground">Open Concerns</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {progress?.totals?.resolvedConcerns || 0}
                </p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Timeline */}
      {progress && (
        <PhaseTimeline
          phases={progress.phases as any}
          currentPhaseId={review.currentPhase?.id}
        />
      )}

      {/* Actions */}
      {progress && (
        <ReviewActions
          reviewId={reviewId}
          status={review.status}
          canAdvance={progress.canAdvance}
          blockers={progress.blockers}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reviewers */}
        <ReviewerPanel reviewId={reviewId} assignments={(assignments || []) as any} />

        {/* Commitments */}
        <CommitmentPanel
          reviewId={reviewId}
          commitments={(commitments || []) as any}
          showOnlyUnresolved
        />
      </div>
    </div>
  );
}
