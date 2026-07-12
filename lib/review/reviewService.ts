/**
 * Phase 4.1: Review Deliberation Service
 *
 * This service manages peer review deliberations - the core workflow
 * for conducting transparent, structured peer reviews.
 */

import { prisma } from "@/lib/prismaclient";
import {
  CreateReviewInput,
  ReviewDeliberationSummary,
  ReviewDeliberationDetails,
  ReviewStatus,
  ReviewDecision,
  ReviewPhaseType,
  PhaseStatus,
  ReviewPhaseSummary,
  ReviewerAssignmentSummary,
  ReviewProgressSummary,
} from "./types";
import {
  parseTemplatePhases,
  parseTemplateSettings,
  STANDARD_PEER_REVIEW_TEMPLATE,
  incrementTemplateUsage,
} from "./templateService";

// ============================================================
// REVIEW CREATION
// ============================================================

/**
 * Create a new review deliberation
 */
export async function createReviewDeliberation(
  input: CreateReviewInput,
  userId: string
): Promise<ReviewDeliberationSummary> {
  const {
    targetType,
    targetSourceId,
    targetUrl,
    targetTitle,
    templateId,
    isBlinded = false,
    isPublicReview = true,
    initialReviewers = [],
  } = input;

  // Get template if provided
  let template = null;
  let phaseConfigs = STANDARD_PEER_REVIEW_TEMPLATE.phases;
  let settings = STANDARD_PEER_REVIEW_TEMPLATE.defaultSettings;

  if (templateId) {
    template = await prisma.reviewTemplate.findUnique({
      where: { id: templateId },
    });
    if (template) {
      phaseConfigs = parseTemplatePhases(template);
      settings = parseTemplateSettings(template);
    }
  }

  // Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create base deliberation
    const deliberation = await tx.deliberation.create({
      data: {
        title: `Review: ${targetTitle}`,
        hostType: "free", // Using 'free' type for peer reviews
        hostId: "peer-review",
        createdById: userId,
      },
    });

    // 2. Create review deliberation
    const review = await tx.reviewDeliberation.create({
      data: {
        deliberationId: deliberation.id,
        targetType,
        targetSourceId,
        targetUrl,
        targetTitle,
        templateId: template?.id,
        status: "INITIATED",
        isBlinded: isBlinded ?? settings?.isBlinded ?? false,
        isPublicReview: isPublicReview ?? settings?.isPublicReview ?? true,
        editorId: userId,
      },
    });

    // 3. Create phases from template
    const phases = await Promise.all(
      phaseConfigs.map((config, index) =>
        tx.reviewPhase.create({
          data: {
            reviewId: review.id,
            name: config.name,
            description: config.description,
            order: index + 1,
            phaseType: config.type,
            status: index === 0 ? "ACTIVE" : "PENDING",
            settings: config as any,
            // Set deadline based on default duration if first phase
            deadline: index === 0 && config.defaultDurationDays
              ? new Date(Date.now() + config.defaultDurationDays * 24 * 60 * 60 * 1000)
              : undefined,
            startDate: index === 0 ? new Date() : undefined,
          },
        })
      )
    );

    // 4. Update current phase
    if (phases.length > 0) {
      await tx.reviewDeliberation.update({
        where: { id: review.id },
        data: { currentPhaseId: phases[0].id },
      });
    }

    // 5. Invite initial reviewers
    if (initialReviewers.length > 0) {
      await Promise.all(
        initialReviewers.map((reviewerId) =>
          tx.reviewerAssignment.create({
            data: {
              reviewId: review.id,
              userId: reviewerId,
              role: "REVIEWER",
              status: "INVITED",
              assignedById: userId,
            },
          })
        )
      );
    }

    // 6. Increment template usage count
    if (template) {
      await tx.reviewTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    return { review, deliberation, phases };
  });

  return formatReviewSummary(result.review, result.deliberation);
}

// ============================================================
// REVIEW RETRIEVAL
// ============================================================

/**
 * Get review deliberation by ID
 */
export async function getReviewDeliberation(
  reviewId: string
): Promise<ReviewDeliberationDetails | null> {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      deliberation: true,
      targetSource: {
        select: {
          id: true,
          title: true,
          authorsJson: true,
        },
      },
      phases: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { outcomes: true } },
        },
      },
      reviewers: {
        include: {
          user: { select: { auth_id: true, name: true, image: true } },
          _count: { select: { commitments: true } },
        },
      },
      editor: { select: { auth_id: true, name: true } },
    },
  });

  if (!review) return null;

  // Count blocking concerns per reviewer
  const blockingCounts = await prisma.reviewerCommitment.groupBy({
    by: ["assignmentId"],
    where: {
      assignmentId: { in: review.reviewers.map((r: { id: string }) => r.id) },
      strength: "BLOCKING",
      isResolved: false,
    },
    _count: true,
  });
  const blockingMap = new Map(
    blockingCounts.map((b: { assignmentId: string; _count: number }) => [b.assignmentId, b._count])
  );

  return {
    id: review.id,
    deliberationId: review.deliberationId,
    targetType: review.targetType as any,
    targetTitle: review.targetTitle,
    targetSourceId: review.targetSourceId ?? undefined,
    targetUrl: review.targetUrl ?? undefined,
    targetSource: review.targetSource
      ? {
          id: review.targetSource.id,
          title: review.targetSource.title ?? "",
          authors: parseAuthors(review.targetSource.authorsJson),
        }
      : undefined,
    status: review.status as ReviewStatus,
    decision: review.decision as ReviewDecision | undefined,
    decisionDate: review.decisionDate ?? undefined,
    decisionNote: review.decisionNote ?? undefined,
    currentPhase: review.phases.find((p: { id: string }) => p.id === review.currentPhaseId)
      ? formatPhaseSummary(
          review.phases.find((p: { id: string }) => p.id === review.currentPhaseId)!
        )
      : undefined,
    templateId: review.templateId ?? undefined,
    isBlinded: review.isBlinded,
    isPublicReview: review.isPublicReview,
    authorUserIds: review.authorUserIds,
    phases: review.phases.map((p: any) => formatPhaseSummary(p)),
    reviewers: review.reviewers.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userImage: r.user.image ?? undefined,
      role: r.role as any,
      status: r.status as any,
      assignedAt: r.assignedAt,
      deadline: r.deadline ?? undefined,
      completedAt: r.completedAt ?? undefined,
      commitmentCount: r._count.commitments,
      blockingConcerns: blockingMap.get(r.id) ?? 0,
    })),
    reviewerCount: review.reviewers.length,
    editor: review.editor
      ? { id: review.editor.auth_id, name: review.editor.name }
      : undefined,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

/**
 * Get review by deliberation ID
 */
export async function getReviewByDeliberationId(
  deliberationId: string
): Promise<ReviewDeliberationSummary | null> {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { deliberationId },
    include: {
      deliberation: true,
      phases: { orderBy: { order: "asc" } },
      reviewers: true,
      editor: { select: { auth_id: true, name: true } },
    },
  });

  if (!review) return null;

  return formatReviewSummary(review, review.deliberation);
}

/**
 * List reviews for a user (as editor, reviewer, or author)
 */
export async function listUserReviews(
  userId: string,
  options?: {
    role?: "editor" | "reviewer" | "author";
    status?: ReviewStatus | ReviewStatus[];
    limit?: number;
    offset?: number;
  }
) {
  const { role, status, limit = 20, offset = 0 } = options ?? {};

  const where: any = {};

  // Filter by role
  if (role === "editor") {
    where.editorId = userId;
  } else if (role === "reviewer") {
    where.reviewers = { some: { userId } };
  } else if (role === "author") {
    where.authorUserIds = { has: userId };
  } else {
    // Any role
    where.OR = [
      { editorId: userId },
      { reviewers: { some: { userId } } },
      { authorUserIds: { has: userId } },
    ];
  }

  // Filter by status
  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }

  const [reviews, total] = await Promise.all([
    prisma.reviewDeliberation.findMany({
      where,
      include: {
        deliberation: true,
        phases: { orderBy: { order: "asc" } },
        reviewers: true,
        editor: { select: { auth_id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.reviewDeliberation.count({ where }),
  ]);

  return {
    items: reviews.map((r: any) => formatReviewSummary(r, r.deliberation)),
    total,
    hasMore: offset + reviews.length < total,
  };
}

// ============================================================
// STATUS & PHASE MANAGEMENT
// ============================================================

/**
 * Update review status
 */
export async function updateReviewStatus(
  reviewId: string,
  status: ReviewStatus,
  userId: string
) {
  // Verify user is editor
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    select: { editorId: true },
  });

  if (!review) throw new Error("Review not found");
  if (review.editorId !== userId) {
    throw new Error("Only the editor can update review status");
  }

  return prisma.reviewDeliberation.update({
    where: { id: reviewId },
    data: { status },
  });
}

/**
 * Make final review decision
 */
export async function makeReviewDecision(
  reviewId: string,
  decision: ReviewDecision,
  note: string,
  userId: string
) {
  // Verify user is editor
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    select: { editorId: true },
  });

  if (!review) throw new Error("Review not found");
  if (review.editorId !== userId) {
    throw new Error("Only the editor can make the final decision");
  }

  return prisma.reviewDeliberation.update({
    where: { id: reviewId },
    data: {
      decision,
      decisionNote: note,
      decisionDate: new Date(),
      status: "COMPLETED",
    },
  });
}

/**
 * Advance to next phase
 */
export async function advanceToNextPhase(
  reviewId: string,
  userId: string
): Promise<ReviewPhaseSummary> {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: { orderBy: { order: "asc" } },
    },
  });

  if (!review) throw new Error("Review not found");
  if (review.editorId !== userId) {
    throw new Error("Only the editor can advance phases");
  }

  const currentPhaseIndex = review.phases.findIndex(
    (p: { id: string }) => p.id === review.currentPhaseId
  );

  if (currentPhaseIndex === -1) {
    throw new Error("Current phase not found");
  }

  if (currentPhaseIndex >= review.phases.length - 1) {
    throw new Error("Already at final phase");
  }

  const currentPhase = review.phases[currentPhaseIndex];
  const nextPhase = review.phases[currentPhaseIndex + 1];

  // Get phase settings for deadline calculation
  const phaseSettings = nextPhase.settings as any;
  const durationDays = phaseSettings?.defaultDurationDays ?? 14;

  await prisma.$transaction([
    // Complete current phase
    prisma.reviewPhase.update({
      where: { id: currentPhase.id },
      data: {
        status: "COMPLETED",
        endDate: new Date(),
      },
    }),
    // Activate next phase
    prisma.reviewPhase.update({
      where: { id: nextPhase.id },
      data: {
        status: "ACTIVE",
        startDate: new Date(),
        deadline: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      },
    }),
    // Update review
    prisma.reviewDeliberation.update({
      where: { id: reviewId },
      data: {
        currentPhaseId: nextPhase.id,
        status: mapPhaseToStatus(nextPhase.phaseType as ReviewPhaseType),
      },
    }),
  ]);

  // Return updated phase
  const updatedPhase = await prisma.reviewPhase.findUnique({
    where: { id: nextPhase.id },
    include: { _count: { select: { outcomes: true } } },
  });

  return formatPhaseSummary(updatedPhase!);
}

/**
 * Skip a phase (mark as skipped and move to next)
 */
export async function skipPhase(
  reviewId: string,
  phaseId: string,
  userId: string
) {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: { phases: { orderBy: { order: "asc" } } },
  });

  if (!review) throw new Error("Review not found");
  if (review.editorId !== userId) {
    throw new Error("Only the editor can skip phases");
  }

  const phaseIndex = review.phases.findIndex((p: { id: string }) => p.id === phaseId);
  if (phaseIndex === -1) throw new Error("Phase not found");

  const phase = review.phases[phaseIndex];
  if (phase.status !== "PENDING") {
    throw new Error("Can only skip pending phases");
  }

  await prisma.reviewPhase.update({
    where: { id: phaseId },
    data: { status: "SKIPPED" },
  });
}

// ============================================================
// PROGRESS TRACKING
// ============================================================

/**
 * Get review progress summary
 */
export async function getReviewProgress(
  reviewId: string
): Promise<ReviewProgressSummary> {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    include: {
      phases: { orderBy: { order: "asc" } },
      reviewers: {
        include: {
          user: { select: { name: true } },
          commitments: {
            select: { strength: true, isResolved: true },
          },
        },
      },
    },
  });

  if (!review) throw new Error("Review not found");

  const now = new Date();

  return {
    status: review.status as ReviewStatus,
    phases: review.phases.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.phaseType as ReviewPhaseType,
      status: p.status as PhaseStatus,
      startDate: p.startDate ?? undefined,
      endDate: p.endDate ?? undefined,
      deadline: p.deadline ?? undefined,
      isOverdue: p.deadline ? p.deadline < now && p.status === "ACTIVE" : false,
    })),
    reviewerProgress: review.reviewers.map((r: any) => ({
      reviewerId: r.userId,
      reviewerName: r.user.name,
      status: r.status as any,
      commitmentsMade: r.commitments.length,
      blockingConcerns: r.commitments.filter(
        (c: any) => c.strength === "BLOCKING" && !c.isResolved
      ).length,
    })),
    totals: {
      openConcerns: review.reviewers.reduce(
        (sum: number, r: any) =>
          sum +
          r.commitments.filter(
            (c: any) =>
              (c.strength === "CONCERN" || c.strength === "STRONG" || c.strength === "BLOCKING") &&
              !c.isResolved
          ).length,
        0
      ),
      resolvedConcerns: review.reviewers.reduce(
        (sum: number, r: any) => sum + r.commitments.filter((c: any) => c.isResolved).length,
        0
      ),
      blockingConcerns: review.reviewers.reduce(
        (sum: number, r: any) =>
          sum +
          r.commitments.filter((c: any) => c.strength === "BLOCKING" && !c.isResolved)
            .length,
        0
      ),
      totalCommitments: review.reviewers.reduce(
        (sum: number, r: any) => sum + r.commitments.length,
        0
      ),
    },
  };
}

// ============================================================
// AUTHOR MANAGEMENT
// ============================================================

/**
 * Set authors for a review (by editor)
 */
export async function setReviewAuthors(
  reviewId: string,
  authorUserIds: string[],
  userId: string
) {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    select: { editorId: true },
  });

  if (!review) throw new Error("Review not found");
  if (review.editorId !== userId) {
    throw new Error("Only the editor can set authors");
  }

  return prisma.reviewDeliberation.update({
    where: { id: reviewId },
    data: { authorUserIds },
  });
}

// ============================================================
// WITHDRAWAL
// ============================================================

/**
 * Withdraw a review (by editor)
 */
export async function withdrawReview(reviewId: string, userId: string) {
  const review = await prisma.reviewDeliberation.findUnique({
    where: { id: reviewId },
    select: { editorId: true, status: true },
  });

  if (!review) throw new Error("Review not found");
  if (review.editorId !== userId) {
    throw new Error("Only the editor can withdraw a review");
  }
  if (review.status === "COMPLETED") {
    throw new Error("Cannot withdraw a completed review");
  }

  return prisma.reviewDeliberation.update({
    where: { id: reviewId },
    data: { status: "WITHDRAWN" },
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Map phase type to review status
 */
function mapPhaseToStatus(phaseType: ReviewPhaseType): ReviewStatus {
  switch (phaseType) {
    case "INITIAL_REVIEW":
    case "SECOND_REVIEW":
      return "IN_REVIEW";
    case "AUTHOR_RESPONSE":
      return "AUTHOR_RESPONSE";
    case "REVISION":
      return "REVISION";
    case "FINAL_DECISION":
      return "DECISION";
    default:
      return "IN_REVIEW";
  }
}

/**
 * Parse authors from JSON (CSL format)
 */
function parseAuthors(authorsJson: any): string[] {
  if (!authorsJson || !Array.isArray(authorsJson)) return [];
  return authorsJson.map((a: any) => {
    if (typeof a === "string") return a;
    const parts = [];
    if (a.given) parts.push(a.given);
    if (a.family) parts.push(a.family);
    return parts.join(" ") || "Unknown";
  });
}

/**
 * Format review for summary response
 */
function formatReviewSummary(
  review: any,
  deliberation: any
): ReviewDeliberationSummary {
  const currentPhase = review.phases?.find(
    (p: any) => p.id === review.currentPhaseId
  );

  return {
    id: review.id,
    deliberationId: deliberation.id,
    targetType: review.targetType,
    targetTitle: review.targetTitle,
    status: review.status,
    decision: review.decision || undefined,
    currentPhase: currentPhase
      ? {
          id: currentPhase.id,
          name: currentPhase.name,
          type: currentPhase.phaseType,
          status: currentPhase.status,
        }
      : undefined,
    reviewerCount: review.reviewers?.length ?? 0,
    editor: review.editor
      ? { id: review.editor.auth_id, name: review.editor.name }
      : undefined,
    createdAt: review.createdAt,
  };
}

/**
 * Format phase for summary response
 */
function formatPhaseSummary(phase: any): ReviewPhaseSummary {
  return {
    id: phase.id,
    name: phase.name,
    type: phase.phaseType,
    order: phase.order,
    status: phase.status,
    startDate: phase.startDate ?? undefined,
    endDate: phase.endDate ?? undefined,
    deadline: phase.deadline ?? undefined,
    outcomeCount: phase._count?.outcomes ?? 0,
  };
}
