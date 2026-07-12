/**
 * Phase 4.1 Part 2: Reviewer Commitment Service
 *
 * This service manages reviewer commitments - the positions and concerns
 * that reviewers record during their review of a work.
 */

import { prisma } from "@/lib/prismaclient";
import {
  CommitmentPosition,
  CommitmentStrength,
  ReviewerCommitmentSummary,
  CreateCommitmentInput,
} from "./types";

/**
 * Create a reviewer commitment
 */
export async function createCommitment(
  assignmentId: string,
  input: CreateCommitmentInput,
  userId: string
): Promise<ReviewerCommitmentSummary> {
  // Verify assignment belongs to user
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.userId !== userId) {
    throw new Error("Assignment not found or unauthorized");
  }

  const commitment = await prisma.reviewerCommitment.create({
    data: {
      assignmentId,
      topic: input.topic,
      description: input.description,
      position: input.position,
      strength: input.strength ?? "MODERATE",
      argumentId: input.argumentId,
      targetClaimId: input.targetClaimId,
    },
    include: {
      assignment: {
        include: {
          user: { select: { auth_id: true, name: true } },
        },
      },
      targetClaim: { select: { id: true, text: true } },
      argument: { select: { id: true, text: true } },
    },
  });

  return formatCommitmentSummary(commitment);
}

/**
 * Update a commitment (creates new version linked to previous)
 */
export async function updateCommitment(
  commitmentId: string,
  updates: Partial<CreateCommitmentInput>,
  userId: string
): Promise<ReviewerCommitmentSummary> {
  const existing = await prisma.reviewerCommitment.findUnique({
    where: { id: commitmentId },
    include: {
      assignment: true,
    },
  });

  if (!existing || existing.assignment.userId !== userId) {
    throw new Error("Commitment not found or unauthorized");
  }

  // Create new commitment that supersedes the old one
  const newCommitment = await prisma.reviewerCommitment.create({
    data: {
      assignmentId: existing.assignmentId,
      topic: updates.topic ?? existing.topic,
      description: updates.description ?? existing.description,
      position: (updates.position ?? existing.position) as CommitmentPosition,
      strength: (updates.strength ?? existing.strength) as CommitmentStrength,
      argumentId: updates.argumentId ?? existing.argumentId,
      targetClaimId: updates.targetClaimId ?? existing.targetClaimId,
      previousCommitmentId: commitmentId,
    },
    include: {
      assignment: {
        include: {
          user: { select: { auth_id: true, name: true } },
        },
      },
      targetClaim: { select: { id: true, text: true } },
      argument: { select: { id: true, text: true } },
    },
  });

  return formatCommitmentSummary(newCommitment);
}

/**
 * Resolve a commitment
 */
export async function resolveCommitment(
  commitmentId: string,
  resolutionNote: string,
  userId: string
) {
  // Verify user has permission (reviewer or editor)
  const commitment = await prisma.reviewerCommitment.findUnique({
    where: { id: commitmentId },
    include: {
      assignment: {
        include: {
          review: true,
        },
      },
    },
  });

  if (!commitment) {
    throw new Error("Commitment not found");
  }

  const isReviewer = commitment.assignment.userId === userId;
  const isEditor = commitment.assignment.review.editorId === userId;

  if (!isReviewer && !isEditor) {
    throw new Error("Unauthorized to resolve this commitment");
  }

  return prisma.reviewerCommitment.update({
    where: { id: commitmentId },
    data: {
      isResolved: true,
      resolutionNote,
      resolvedAt: new Date(),
    },
  });
}

/**
 * Reopen a resolved commitment
 */
export async function reopenCommitment(
  commitmentId: string,
  userId: string
) {
  const commitment = await prisma.reviewerCommitment.findUnique({
    where: { id: commitmentId },
    include: {
      assignment: {
        include: {
          review: true,
        },
      },
    },
  });

  if (!commitment) {
    throw new Error("Commitment not found");
  }

  const isReviewer = commitment.assignment.userId === userId;
  const isEditor = commitment.assignment.review.editorId === userId;

  if (!isReviewer && !isEditor) {
    throw new Error("Unauthorized to reopen this commitment");
  }

  return prisma.reviewerCommitment.update({
    where: { id: commitmentId },
    data: {
      isResolved: false,
      resolutionNote: null,
      resolvedAt: null,
    },
  });
}

/**
 * Get commitments for a review
 */
export async function getReviewCommitments(
  reviewId: string,
  options?: {
    onlyBlocking?: boolean;
    onlyUnresolved?: boolean;
    reviewerId?: string;
  }
): Promise<ReviewerCommitmentSummary[]> {
  const where: any = {
    assignment: { reviewId },
  };

  if (options?.onlyBlocking) {
    where.strength = "BLOCKING";
  }

  if (options?.onlyUnresolved) {
    where.isResolved = false;
  }

  if (options?.reviewerId) {
    where.assignment.userId = options.reviewerId;
  }

  const commitments = await prisma.reviewerCommitment.findMany({
    where,
    include: {
      assignment: {
        include: {
          user: { select: { auth_id: true, name: true } },
        },
      },
      targetClaim: { select: { id: true, text: true } },
      argument: { select: { id: true, text: true } },
    },
    orderBy: [{ strength: "desc" }, { createdAt: "desc" }],
  });

  return commitments.map(formatCommitmentSummary);
}

/**
 * Get commitments for an assignment
 */
export async function getAssignmentCommitments(
  assignmentId: string
): Promise<ReviewerCommitmentSummary[]> {
  const commitments = await prisma.reviewerCommitment.findMany({
    where: { assignmentId },
    include: {
      assignment: {
        include: {
          user: { select: { auth_id: true, name: true } },
        },
      },
      targetClaim: { select: { id: true, text: true } },
      argument: { select: { id: true, text: true } },
    },
    orderBy: [{ strength: "desc" }, { createdAt: "desc" }],
  });

  return commitments.map(formatCommitmentSummary);
}

/**
 * Get commitment history (all versions)
 */
export async function getCommitmentHistory(
  commitmentId: string
): Promise<ReviewerCommitmentSummary[]> {
  const history: any[] = [];
  let currentId: string | null = commitmentId;

  while (currentId) {
    const commitment: any = await prisma.reviewerCommitment.findUnique({
      where: { id: currentId },
      include: {
        assignment: {
          include: {
            user: { select: { auth_id: true, name: true } },
          },
        },
        targetClaim: { select: { id: true, text: true } },
        argument: { select: { id: true, text: true } },
      },
    });

    if (!commitment) break;

    history.push(formatCommitmentSummary(commitment));
    currentId = commitment.previousCommitmentId;
  }

  return history;
}

/**
 * Get blocking concerns summary for a review
 */
export async function getBlockingConcernsSummary(reviewId: string) {
  const concerns = await prisma.reviewerCommitment.findMany({
    where: {
      assignment: { reviewId },
      strength: "BLOCKING",
    },
    include: {
      assignment: {
        include: {
          user: { select: { auth_id: true, name: true } },
        },
      },
    },
  });

  const resolved = concerns.filter((c) => c.isResolved);
  const unresolved = concerns.filter((c) => !c.isResolved);

  return {
    total: concerns.length,
    resolved: resolved.length,
    unresolved: unresolved.length,
    unresolvedConcerns: unresolved.map((c) => ({
      id: c.id,
      topic: c.topic,
      reviewer: c.assignment.user?.name || "Anonymous",
      position: c.position,
    })),
  };
}

/**
 * Get commitment statistics for a review
 */
export async function getCommitmentStats(reviewId: string) {
  const commitments = await prisma.reviewerCommitment.findMany({
    where: {
      assignment: { reviewId },
    },
  });

  const stats = {
    total: commitments.length,
    byPosition: {} as Record<CommitmentPosition, number>,
    byStrength: {} as Record<CommitmentStrength, number>,
    resolved: 0,
    unresolved: 0,
  };

  // Initialize counts
  const positions: CommitmentPosition[] = [
    "STRONGLY_SUPPORT",
    "SUPPORT",
    "NEUTRAL",
    "CONCERN",
    "STRONGLY_OPPOSE",
  ];
  const strengths: CommitmentStrength[] = ["WEAK", "MODERATE", "STRONG", "BLOCKING"];

  positions.forEach((p) => (stats.byPosition[p] = 0));
  strengths.forEach((s) => (stats.byStrength[s] = 0));

  // Count
  commitments.forEach((c) => {
    stats.byPosition[c.position as CommitmentPosition]++;
    stats.byStrength[c.strength as CommitmentStrength]++;
    if (c.isResolved) stats.resolved++;
    else stats.unresolved++;
  });

  return stats;
}

/**
 * Format commitment for API response
 */
function formatCommitmentSummary(commitment: any): ReviewerCommitmentSummary {
  return {
    id: commitment.id,
    topic: commitment.topic,
    description: commitment.description,
    position: commitment.position as CommitmentPosition,
    strength: commitment.strength as CommitmentStrength,
    isResolved: commitment.isResolved,
    resolutionNote: commitment.resolutionNote ?? undefined,
    targetClaim: commitment.targetClaim
      ? {
          id: commitment.targetClaim.id,
          text: commitment.targetClaim.text,
        }
      : undefined,
    argument: commitment.argument
      ? {
          id: commitment.argument.id,
          summary: commitment.argument.text?.substring(0, 200) || "",
        }
      : undefined,
    reviewer: {
      id: commitment.assignment?.userId || "",
      name: commitment.assignment?.user?.name || "Anonymous",
    },
    previousCommitmentId: commitment.previousCommitmentId ?? undefined,
    createdAt: commitment.createdAt,
    updatedAt: commitment.updatedAt,
  };
}
