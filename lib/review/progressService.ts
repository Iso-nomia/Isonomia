/**
 * Phase 4.1 Part 2: Review Progress Service
 *
 * This service tracks review progress, provides timeline information,
 * and determines if reviews can advance to the next phase.
 */

import { prisma } from "@/lib/prismaclient";
import {
  ReviewProgressSummary,
  ReviewPhaseType,
  PhaseStatus,
  ReviewStatus,
} from "./types";

/**
 * Get comprehensive review progress
 */
export async function getReviewProgress(
  reviewId: string
): Promise<ReviewProgressSummary> {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: {
        orderBy: { order: "asc" },
      },
      reviewers: {
        include: {
          commitments: true,
          user: { select: { name: true, username: true } },
        },
      },
    },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  // Calculate concerns
  let openConcerns = 0;
  let resolvedConcerns = 0;
  let blockingConcerns = 0;
  let totalCommitments = 0;

  const reviewerProgress = review.reviewers.map((r) => {
    const blocking = r.commitments.filter(
      (c) => c.strength === "BLOCKING" && !c.isResolved
    );
    const resolved = r.commitments.filter((c) => c.isResolved);

    openConcerns += blocking.length;
    resolvedConcerns += resolved.length;
    blockingConcerns += blocking.length;
    totalCommitments += r.commitments.length;

    return {
      reviewerId: r.userId,
      reviewerName: r.user?.name ?? r.user?.username ?? r.userId,
      status: r.status,
      commitmentsMade: r.commitments.length,
      blockingConcerns: blocking.length,
    };
  });

  return {
    status: review.status as ReviewStatus,
    phases: review.phases.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.phaseType as ReviewPhaseType,
      status: p.status as PhaseStatus,
      startDate: p.startDate || undefined,
      endDate: p.endDate || undefined,
      deadline: p.deadline || undefined,
      isOverdue:
        !!p.deadline &&
        p.deadline.getTime() < Date.now() &&
        p.status !== ("COMPLETED" as PhaseStatus),
    })),
    reviewerProgress,
    totals: {
      openConcerns,
      resolvedConcerns,
      blockingConcerns,
      totalCommitments,
    },
  };
}

/**
 * Check if review can advance to next phase
 */
export async function canAdvancePhase(
  reviewId: string
): Promise<{ canAdvance: boolean; blockers: string[] }> {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: { orderBy: { order: "asc" } },
      reviewers: {
        include: {
          commitments: {
            where: { strength: "BLOCKING", isResolved: false },
          },
        },
      },
    },
  });

  if (!review) {
    return { canAdvance: false, blockers: ["Review not found"] };
  }

  const blockers: string[] = [];

  // Find current phase
  const currentPhase = review.phases.find(
    (p) => p.id === review.currentPhaseId
  );

  if (!currentPhase) {
    return { canAdvance: false, blockers: ["No current phase"] };
  }

  // Check if all active reviewers have completed
  if (
    currentPhase.phaseType === "INITIAL_REVIEW" ||
    currentPhase.phaseType === "SECOND_REVIEW"
  ) {
    const activeReviewers = review.reviewers.filter(
      (r) => r.status === "IN_PROGRESS"
    );
    if (activeReviewers.length > 0) {
      blockers.push(
        `${activeReviewers.length} reviewer(s) still in progress`
      );
    }
  }

  // Check for unresolved blocking concerns if moving to decision
  if (currentPhase.phaseType === "AUTHOR_RESPONSE") {
    const blockingCount = review.reviewers.reduce(
      (sum, r) => sum + r.commitments.length,
      0
    );
    if (blockingCount > 0) {
      blockers.push(`${blockingCount} unresolved blocking concern(s)`);
    }
  }

  return {
    canAdvance: blockers.length === 0,
    blockers,
  };
}

/**
 * Get review timeline
 */
export async function getReviewTimeline(reviewId: string) {
  const events: Array<{
    type: string;
    date: Date;
    actor?: string;
    details: string;
  }> = [];

  // Get review with phases
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: { orderBy: { order: "asc" } },
      reviewers: {
        include: {
          user: { select: { name: true } },
        },
      },
      authorResponses: {
        include: {
          author: { select: { name: true } },
          phase: { select: { name: true } },
        },
      },
    },
  });

  if (!review) return events;

  // Review created
  events.push({
    type: "REVIEW_CREATED",
    date: review.createdAt,
    details: `Review initiated for "${review.targetTitle}"`,
  });

  // Reviewer invitations and acceptances
  review.reviewers.forEach((r) => {
    events.push({
      type: "REVIEWER_INVITED",
      date: r.assignedAt,
      actor: r.user?.name || "Unknown",
      details: `${r.user?.name || "Reviewer"} invited to review`,
    });

    if (r.respondedAt) {
      events.push({
        type:
          r.status === "ACCEPTED" ? "REVIEWER_ACCEPTED" : "REVIEWER_DECLINED",
        date: r.respondedAt,
        actor: r.user?.name || "Unknown",
        details: `${r.user?.name || "Reviewer"} ${
          r.status === "ACCEPTED" ? "accepted" : "declined"
        } invitation`,
      });
    }

    if (r.completedAt) {
      events.push({
        type: "REVIEW_SUBMITTED",
        date: r.completedAt,
        actor: r.user?.name || "Unknown",
        details: `${r.user?.name || "Reviewer"} submitted review`,
      });
    }
  });

  // Phase transitions
  review.phases.forEach((p) => {
    if (p.startDate) {
      events.push({
        type: "PHASE_STARTED",
        date: p.startDate,
        details: `Phase "${p.name}" started`,
      });
    }
    if (p.endDate) {
      events.push({
        type: "PHASE_COMPLETED",
        date: p.endDate,
        details: `Phase "${p.name}" completed`,
      });
    }
  });

  // Author responses
  review.authorResponses.forEach((ar) => {
    events.push({
      type: "AUTHOR_RESPONSE",
      date: ar.createdAt,
      actor: ar.author?.name || "Author",
      details: `${ar.author?.name || "Author"} submitted response for phase "${ar.phase?.name || "Unknown"}"`,
    });
  });

  // Decision made
  if (review.decisionDate && review.decision) {
    events.push({
      type: "DECISION_MADE",
      date: review.decisionDate,
      details: `Review decision: ${review.decision}`,
    });
  }

  // Sort by date
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get review statistics
 */
export async function getReviewStats(reviewId: string) {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: true,
      reviewers: {
        include: {
          commitments: true,
        },
      },
      authorResponses: {
        include: {
          moves: true,
        },
      },
    },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  const totalCommitments = review.reviewers.reduce(
    (sum, r) => sum + r.commitments.length,
    0
  );
  const blockingCommitments = review.reviewers.reduce(
    (sum, r) => sum + r.commitments.filter((c) => c.strength === "BLOCKING").length,
    0
  );
  const resolvedCommitments = review.reviewers.reduce(
    (sum, r) => sum + r.commitments.filter((c) => c.isResolved).length,
    0
  );

  const totalMoves = review.authorResponses.reduce(
    (sum, ar) => sum + ar.moves.length,
    0
  );

  const daysInReview = Math.floor(
    (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    reviewId,
    status: review.status,
    daysInReview,
    phases: {
      total: review.phases.length,
      completed: review.phases.filter((p) => p.status === "COMPLETED").length,
      current: review.phases.find((p) => p.id === review.currentPhaseId)?.name,
    },
    reviewers: {
      total: review.reviewers.length,
      accepted: review.reviewers.filter((r) => r.status === "ACCEPTED" || r.status === "IN_PROGRESS" || r.status === "COMPLETED").length,
      completed: review.reviewers.filter((r) => r.status === "COMPLETED").length,
    },
    commitments: {
      total: totalCommitments,
      blocking: blockingCommitments,
      resolved: resolvedCommitments,
      resolutionRate: totalCommitments > 0 ? resolvedCommitments / totalCommitments : 0,
    },
    authorResponses: {
      total: review.authorResponses.length,
      totalMoves,
    },
  };
}

/**
 * Get a summary of phase durations
 */
export async function getPhaseDurations(reviewId: string) {
  const phases = await prisma.reviewPhase.findMany({
    where: { reviewId },
    orderBy: { order: "asc" },
  });

  return phases.map((p) => {
    const startDate = p.startDate?.getTime() || 0;
    const endDate = p.endDate?.getTime() || Date.now();
    const durationMs = startDate ? endDate - startDate : 0;
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

    return {
      id: p.id,
      name: p.name,
      type: p.phaseType,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      durationDays,
      isOverDeadline: p.deadline && p.deadline.getTime() < Date.now() && p.status !== "COMPLETED",
    };
  });
}

/**
 * Check review health - identifies potential issues
 */
export async function checkReviewHealth(reviewId: string) {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: true,
      reviewers: {
        include: {
          commitments: {
            where: { strength: "BLOCKING", isResolved: false },
          },
        },
      },
    },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for stale reviewers
  const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
  review.reviewers.forEach((r) => {
    if (r.status === "IN_PROGRESS") {
      const startedAt = r.respondedAt ?? r.assignedAt;
      const staleDuration = Date.now() - startedAt.getTime();
      if (staleDuration > staleThreshold) {
        warnings.push(`Reviewer ${r.userId} has been in progress for over 7 days`);
      }
    }
  });

  // Check for overdue phases
  const currentPhase = review.phases.find((p) => p.id === review.currentPhaseId);
  if (currentPhase?.deadline && currentPhase.deadline.getTime() < Date.now()) {
    errors.push(`Current phase "${currentPhase.name}" is past deadline`);
  }

  // Check for unresolved blocking concerns
  const unresolvedBlocking = review.reviewers.reduce(
    (sum, r) => sum + r.commitments.length,
    0
  );
  if (unresolvedBlocking > 0 && review.status === "AUTHOR_RESPONSE") {
    warnings.push(`${unresolvedBlocking} unresolved blocking concerns require attention`);
  }

  // Check for reviewers who haven't responded
  const pendingReviewers = review.reviewers.filter((r) => r.status === "INVITED");
  if (pendingReviewers.length > 0) {
    warnings.push(`${pendingReviewers.length} reviewer(s) haven't responded to invitation`);
  }

  return {
    healthy: errors.length === 0,
    warnings,
    errors,
    summary: errors.length > 0
      ? "Review has critical issues"
      : warnings.length > 0
      ? "Review has warnings"
      : "Review is healthy",
  };
}
