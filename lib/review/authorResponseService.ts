/**
 * Phase 4.1 Part 2: Author Response Service
 *
 * This service manages author responses to reviewer feedback,
 * including the various "moves" an author can make in response
 * to commitments/concerns raised by reviewers.
 */

import { prisma } from "@/lib/prismaclient";

export type ResponseMoveType =
  | "CONCEDE"
  | "DEFEND"
  | "QUALIFY"
  | "REVISE"
  | "DEFER"
  | "CLARIFY"
  | "CHALLENGE";

export interface AuthorResponseMoveInput {
  targetCommitmentId?: string;
  targetArgumentId?: string;
  moveType: ResponseMoveType;
  explanation: string;
  supportingArgumentId?: string;
  revisionDescription?: string;
  revisionLocation?: string;
}

export interface CreateAuthorResponseInput {
  reviewId: string;
  phaseId: string;
  summary: string;
  moves: AuthorResponseMoveInput[];
  revisionId?: string;
}

/**
 * Create an author response
 */
export async function createAuthorResponse(
  input: CreateAuthorResponseInput,
  userId: string
) {
  const { reviewId, phaseId, summary, moves, revisionId } = input;

  // Verify user is an author on this review
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  if (!review.authorUserIds.includes(userId)) {
    throw new Error("User is not an author on this review");
  }

  // Create response with moves
  return prisma.authorResponse.create({
    data: {
      reviewId,
      phaseId,
      authorId: userId,
      summary,
      revisionId,
      moves: {
        create: moves.map((move) => ({
          targetCommitmentId: move.targetCommitmentId,
          targetArgumentId: move.targetArgumentId,
          moveType: move.moveType,
          explanation: move.explanation,
          supportingArgumentId: move.supportingArgumentId,
          revisionDescription: move.revisionDescription,
          revisionLocation: move.revisionLocation,
        })),
      },
    },
    include: {
      moves: {
        include: {
          targetCommitment: { select: { id: true, topic: true } },
          targetArgument: { select: { id: true, text: true } },
        },
      },
      author: { select: { auth_id: true, name: true } },
    },
  });
}

/**
 * Get author responses for a review
 */
export async function getAuthorResponses(reviewId: string) {
  return prisma.authorResponse.findMany({
    where: { reviewId },
    include: {
      moves: {
        include: {
          targetCommitment: { select: { id: true, topic: true } },
          targetArgument: { select: { id: true, text: true } },
        },
      },
      author: { select: { auth_id: true, name: true } },
      phase: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get author response by ID
 */
export async function getAuthorResponse(responseId: string) {
  return prisma.authorResponse.findUnique({
    where: { id: responseId },
    include: {
      moves: {
        include: {
          targetCommitment: { select: { id: true, topic: true, description: true } },
          targetArgument: { select: { id: true, text: true } },
          supportingArgument: { select: { id: true, text: true } },
        },
      },
      author: { select: { auth_id: true, name: true } },
      phase: { select: { id: true, name: true } },
      review: { select: { id: true, targetTitle: true } },
    },
  });
}

/**
 * Get response summary by move type
 */
export async function getResponseSummary(reviewId: string) {
  const responses = await prisma.authorResponse.findMany({
    where: { reviewId },
    include: {
      moves: true,
    },
  });

  const moveCounts: Record<ResponseMoveType, number> = {
    CONCEDE: 0,
    DEFEND: 0,
    QUALIFY: 0,
    REVISE: 0,
    DEFER: 0,
    CLARIFY: 0,
    CHALLENGE: 0,
  };

  responses.forEach((response) => {
    response.moves.forEach((move) => {
      moveCounts[move.moveType as ResponseMoveType]++;
    });
  });

  const totalMoves = Object.values(moveCounts).reduce((a, b) => a + b, 0);

  return {
    responseCount: responses.length,
    totalMoves,
    moveCounts,
    concessionRate:
      totalMoves > 0 ? (moveCounts.CONCEDE + moveCounts.QUALIFY) / totalMoves : 0,
    revisionRate: totalMoves > 0 ? moveCounts.REVISE / totalMoves : 0,
  };
}

/**
 * Find unaddressed commitments
 */
export async function getUnaddressedCommitments(reviewId: string) {
  // Get all commitments
  const commitments = await prisma.reviewerCommitment.findMany({
    where: {
      assignment: { reviewId },
    },
    select: { id: true },
  });

  // Get all addressed commitment IDs
  const addressedIds = await prisma.authorResponseMove.findMany({
    where: {
      response: { reviewId },
      targetCommitmentId: { not: null },
    },
    select: { targetCommitmentId: true },
  });

  const addressedSet = new Set(addressedIds.map((a) => a.targetCommitmentId));
  const unaddressedIds = commitments
    .filter((c) => !addressedSet.has(c.id))
    .map((c) => c.id);

  // Fetch full commitment details for unaddressed
  return prisma.reviewerCommitment.findMany({
    where: { id: { in: unaddressedIds } },
    include: {
      assignment: {
        include: {
          user: { select: { name: true } },
        },
      },
    },
    orderBy: [{ strength: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * Analyze author response patterns
 */
export async function analyzeResponsePatterns(authorId: string) {
  const responses = await prisma.authorResponse.findMany({
    where: { authorId },
    include: {
      moves: true,
      review: { select: { decision: true } },
    },
  });

  const patterns = {
    totalResponses: responses.length,
    reviewsWithConcession: 0,
    reviewsWithDefense: 0,
    averageMovesPerResponse: 0,
    acceptanceRateAfterConcession: 0,
    acceptanceRateAfterDefense: 0,
  };

  let totalMoves = 0;
  let concessionsLeadingToAccept = 0;
  let defensesLeadingToAccept = 0;
  let reviewsWithConcession = 0;
  let reviewsWithDefense = 0;

  responses.forEach((response) => {
    totalMoves += response.moves.length;

    const hasConcession = response.moves.some(
      (m) => m.moveType === "CONCEDE" || m.moveType === "QUALIFY"
    );
    const hasDefense = response.moves.some(
      (m) => m.moveType === "DEFEND" || m.moveType === "CHALLENGE"
    );
    const wasAccepted =
      response.review.decision === "ACCEPT" ||
      response.review.decision === "MINOR_REVISION";

    if (hasConcession) {
      reviewsWithConcession++;
      if (wasAccepted) concessionsLeadingToAccept++;
    }

    if (hasDefense) {
      reviewsWithDefense++;
      if (wasAccepted) defensesLeadingToAccept++;
    }
  });

  patterns.reviewsWithConcession = reviewsWithConcession;
  patterns.reviewsWithDefense = reviewsWithDefense;
  patterns.averageMovesPerResponse =
    responses.length > 0 ? totalMoves / responses.length : 0;
  patterns.acceptanceRateAfterConcession =
    reviewsWithConcession > 0
      ? concessionsLeadingToAccept / reviewsWithConcession
      : 0;
  patterns.acceptanceRateAfterDefense =
    reviewsWithDefense > 0 ? defensesLeadingToAccept / reviewsWithDefense : 0;

  return patterns;
}

/**
 * Update an existing author response
 */
export async function updateAuthorResponse(
  responseId: string,
  updates: { summary?: string; revisionId?: string },
  userId: string
) {
  const response = await prisma.authorResponse.findUnique({
    where: { id: responseId },
    include: { review: true },
  });

  if (!response) {
    throw new Error("Response not found");
  }

  if (response.authorId !== userId) {
    throw new Error("Unauthorized to update this response");
  }

  return prisma.authorResponse.update({
    where: { id: responseId },
    data: {
      summary: updates.summary,
      revisionId: updates.revisionId,
    },
  });
}

/**
 * Add a move to an existing response
 */
export async function addResponseMove(
  responseId: string,
  move: AuthorResponseMoveInput,
  userId: string
) {
  const response = await prisma.authorResponse.findUnique({
    where: { id: responseId },
  });

  if (!response) {
    throw new Error("Response not found");
  }

  if (response.authorId !== userId) {
    throw new Error("Unauthorized to add move to this response");
  }

  return prisma.authorResponseMove.create({
    data: {
      responseId,
      targetCommitmentId: move.targetCommitmentId,
      targetArgumentId: move.targetArgumentId,
      moveType: move.moveType,
      explanation: move.explanation,
      supportingArgumentId: move.supportingArgumentId,
      revisionDescription: move.revisionDescription,
      revisionLocation: move.revisionLocation,
    },
    include: {
      targetCommitment: { select: { id: true, topic: true } },
      targetArgument: { select: { id: true, text: true } },
    },
  });
}

/**
 * Delete a move from a response
 */
export async function deleteResponseMove(
  moveId: string,
  userId: string
) {
  const move = await prisma.authorResponseMove.findUnique({
    where: { id: moveId },
    include: { response: true },
  });

  if (!move) {
    throw new Error("Move not found");
  }

  if (move.response.authorId !== userId) {
    throw new Error("Unauthorized to delete this move");
  }

  return prisma.authorResponseMove.delete({
    where: { id: moveId },
  });
}

/**
 * Get moves for a specific commitment
 */
export async function getMovesForCommitment(commitmentId: string) {
  return prisma.authorResponseMove.findMany({
    where: { targetCommitmentId: commitmentId },
    include: {
      response: {
        include: {
          author: { select: { name: true } },
          phase: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * UI labels for move types
 */
export const MOVE_TYPE_LABELS: Record<ResponseMoveType, string> = {
  CONCEDE: "Concede",
  DEFEND: "Defend",
  QUALIFY: "Qualify",
  REVISE: "Revise",
  DEFER: "Defer",
  CLARIFY: "Clarify",
  CHALLENGE: "Challenge",
};

export const MOVE_TYPE_DESCRIPTIONS: Record<ResponseMoveType, string> = {
  CONCEDE: "Accept the criticism and commit to addressing it",
  DEFEND: "Defend the current approach with justification",
  QUALIFY: "Partially accept with nuance or context",
  REVISE: "Describe a revision already made",
  DEFER: "Acknowledge but defer to future work",
  CLARIFY: "Provide clarification without changing content",
  CHALLENGE: "Challenge the reviewer's position",
};
