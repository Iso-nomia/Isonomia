/**
 * Phase 4.1 Part 2: Reviewer Assignment Service
 *
 * This service manages reviewer assignments - invitations, acceptances,
 * and tracking of review completion status.
 */

import { prisma } from "@/lib/prismaclient";
import {
  ReviewerRole,
  ReviewerStatus,
  ReviewerAssignmentSummary,
} from "./types";

/**
 * Invite a reviewer to a review
 */
export async function inviteReviewer(
  reviewId: string,
  userId: string,
  role: ReviewerRole,
  assignedById: string,
  deadline?: Date
): Promise<ReviewerAssignmentSummary> {
  // Check if already assigned
  const existing = await prisma.reviewerAssignment.findUnique({
    where: {
      reviewId_userId: { reviewId, userId },
    },
  });

  if (existing) {
    throw new Error("Reviewer already assigned to this review");
  }

  const assignment = await prisma.reviewerAssignment.create({
    data: {
      reviewId,
      userId,
      role,
      status: "INVITED",
      assignedById,
      deadline,
    },
    include: {
      user: { select: { auth_id: true, name: true, image: true } },
      commitments: true,
    },
  });

  return formatAssignmentSummary(assignment);
}

/**
 * Respond to reviewer invitation
 */
export async function respondToInvitation(
  assignmentId: string,
  userId: string,
  accept: boolean,
  declineReason?: string
) {
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.userId !== userId) {
    throw new Error("Assignment not found or unauthorized");
  }

  if (assignment.status !== "INVITED") {
    throw new Error("Invitation already responded to");
  }

  return prisma.reviewerAssignment.update({
    where: { id: assignmentId },
    data: {
      status: accept ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
      declineReason: accept ? null : declineReason,
    },
  });
}

/**
 * Start review (mark as in progress)
 */
export async function startReview(assignmentId: string, userId: string) {
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.userId !== userId) {
    throw new Error("Assignment not found or unauthorized");
  }

  if (assignment.status !== "ACCEPTED") {
    throw new Error("Must accept invitation before starting review");
  }

  return prisma.reviewerAssignment.update({
    where: { id: assignmentId },
    data: { status: "IN_PROGRESS" },
  });
}

/**
 * Complete review
 */
export async function completeReview(assignmentId: string, userId: string) {
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      commitments: {
        where: {
          strength: "BLOCKING",
          isResolved: false,
        },
      },
    },
  });

  if (!assignment || assignment.userId !== userId) {
    throw new Error("Assignment not found or unauthorized");
  }

  // Warn about unresolved blocking concerns
  if (assignment.commitments.length > 0) {
    console.warn(
      `Reviewer ${userId} completing review with ${assignment.commitments.length} unresolved blocking concerns`
    );
  }

  return prisma.reviewerAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

/**
 * Withdraw from review
 */
export async function withdrawFromReview(
  assignmentId: string,
  userId: string,
  reason?: string
) {
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.userId !== userId) {
    throw new Error("Assignment not found or unauthorized");
  }

  if (assignment.status === "COMPLETED") {
    throw new Error("Cannot withdraw from completed review");
  }

  return prisma.reviewerAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "WITHDRAWN",
      declineReason: reason,
    },
  });
}

/**
 * Get reviewer assignments for a review
 */
export async function getReviewerAssignments(
  reviewId: string
): Promise<ReviewerAssignmentSummary[]> {
  const assignments = await prisma.reviewerAssignment.findMany({
    where: { reviewId },
    include: {
      user: { select: { auth_id: true, name: true, image: true } },
      commitments: true,
    },
    orderBy: { assignedAt: "asc" },
  });

  return assignments.map(formatAssignmentSummary);
}

/**
 * Get assignments for a user
 */
export async function getUserAssignments(
  userId: string,
  status?: ReviewerStatus[]
) {
  const where: any = { userId };
  if (status && status.length > 0) {
    where.status = { in: status };
  }

  return prisma.reviewerAssignment.findMany({
    where,
    include: {
      review: {
        include: {
          deliberation: { select: { title: true } },
        },
      },
    },
    orderBy: { deadline: "asc" },
  });
}

/**
 * Get pending invitations for a user
 */
export async function getPendingInvitations(userId: string) {
  return prisma.reviewerAssignment.findMany({
    where: {
      userId,
      status: "INVITED",
    },
    include: {
      review: {
        select: {
          id: true,
          targetTitle: true,
          targetType: true,
          isBlinded: true,
        },
      },
      assignedBy: { select: { name: true } },
    },
    orderBy: { deadline: "asc" },
  });
}

/**
 * Get active reviews for a user (accepted or in progress)
 */
export async function getActiveReviews(userId: string) {
  return prisma.reviewerAssignment.findMany({
    where: {
      userId,
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
    },
    include: {
      review: {
        include: {
          phases: {
            where: { status: "ACTIVE" },
            take: 1,
          },
        },
      },
      commitments: {
        where: { isResolved: false },
      },
    },
    orderBy: { deadline: "asc" },
  });
}

/**
 * Update assignment deadline
 */
export async function updateDeadline(
  assignmentId: string,
  deadline: Date,
  editorId: string
) {
  // Verify editor permission
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      review: { select: { editorId: true } },
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (assignment.review.editorId !== editorId) {
    throw new Error("Only the editor can update deadlines");
  }

  return prisma.reviewerAssignment.update({
    where: { id: assignmentId },
    data: { deadline },
  });
}

/**
 * Change reviewer role
 */
export async function changeReviewerRole(
  assignmentId: string,
  role: ReviewerRole,
  editorId: string
) {
  // Verify editor permission
  const assignment = await prisma.reviewerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      review: { select: { editorId: true } },
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (assignment.review.editorId !== editorId) {
    throw new Error("Only the editor can change reviewer roles");
  }

  return prisma.reviewerAssignment.update({
    where: { id: assignmentId },
    data: { role },
  });
}

/**
 * Format assignment for API response
 */
function formatAssignmentSummary(assignment: any): ReviewerAssignmentSummary {
  const blockingConcerns = assignment.commitments?.filter(
    (c: any) => c.strength === "BLOCKING" && !c.isResolved
  ).length || 0;

  return {
    id: assignment.id,
    userId: assignment.userId,
    userName: assignment.user?.name || "Anonymous",
    userImage: assignment.user?.image ?? undefined,
    role: assignment.role as ReviewerRole,
    status: assignment.status as ReviewerStatus,
    assignedAt: assignment.assignedAt,
    deadline: assignment.deadline ?? undefined,
    completedAt: assignment.completedAt ?? undefined,
    commitmentCount: assignment.commitments?.length || 0,
    blockingConcerns,
  };
}
