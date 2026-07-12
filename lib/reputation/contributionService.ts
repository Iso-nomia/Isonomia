/**
 * Service for recording and tracking contributions
 * Phase 4.2: Argumentation-Based Reputation
 */

import { prisma } from "@/lib/prismaclient";
import {
  ContributionType,
  ContributionDetails,
  ContributionEvent,
  CONTRIBUTION_WEIGHTS,
} from "./types";

/**
 * Record a contribution
 */
export async function recordContribution(event: ContributionEvent) {
  const { type, userId, details, timestamp } = event;

  // Calculate base weight
  const baseWeight = CONTRIBUTION_WEIGHTS[type] || 1.0;

  // Calculate quality multiplier based on type and details
  const qualityMultiplier = calculateQualityMultiplier(type, details);

  // Create contribution record
  const contribution = await prisma.scholarContribution.create({
    data: {
      userId: BigInt(userId),
      type,
      deliberationId: details.deliberationId,
      argumentId: details.argumentId,
      reviewId: details.reviewId,
      details: details as object,
      baseWeight,
      qualityMultiplier,
      createdAt: timestamp || new Date(),
    },
  });

  // Trigger stats update (async, don't await)
  updateScholarStatsAsync(userId).catch(console.error);

  return contribution;
}

/**
 * Record multiple contributions in batch
 */
export async function recordContributions(events: ContributionEvent[]) {
  const contributions = await prisma.$transaction(
    events.map((event) =>
      prisma.scholarContribution.create({
        data: {
          userId: BigInt(event.userId),
          type: event.type,
          deliberationId: event.details.deliberationId,
          argumentId: event.details.argumentId,
          reviewId: event.details.reviewId,
          details: event.details as object,
          baseWeight: CONTRIBUTION_WEIGHTS[event.type] || 1.0,
          qualityMultiplier: calculateQualityMultiplier(
            event.type,
            event.details
          ),
          createdAt: event.timestamp || new Date(),
        },
      })
    )
  );

  // Update stats for all unique users
  const userIds = [...new Set(events.map((e) => e.userId))];
  userIds.forEach((userId) =>
    updateScholarStatsAsync(userId).catch(console.error)
  );

  return contributions;
}

/**
 * Get contributions for a user
 */
export async function getUserContributions(
  userId: string,
  options?: {
    type?: ContributionType;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }
) {
  const where: {
    userId: bigint;
    type?: ContributionType;
    createdAt?: { gte?: Date; lte?: Date };
  } = { userId: BigInt(userId) };

  if (options?.type) {
    where.type = options.type;
  }

  if (options?.fromDate || options?.toDate) {
    where.createdAt = {};
    if (options.fromDate) where.createdAt.gte = options.fromDate;
    if (options.toDate) where.createdAt.lte = options.toDate;
  }

  return prisma.scholarContribution.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit,
    include: {
      deliberation: { select: { id: true, title: true } },
      argument: { select: { id: true, text: true } },
    },
  });
}

/**
 * Get contribution summary by type
 */
export async function getContributionSummary(userId: string) {
  const contributions = await prisma.scholarContribution.groupBy({
    by: ["type"],
    where: { userId: BigInt(userId) },
    _count: { id: true },
    _sum: { baseWeight: true, qualityMultiplier: true },
  });

  return contributions.map((c) => ({
    type: c.type,
    count: c._count.id,
    totalWeight: (c._sum.baseWeight || 0) * (c._sum.qualityMultiplier || 1),
  }));
}

/**
 * Get recent contributions across all users (for activity feed)
 */
export async function getRecentContributions(options?: {
  limit?: number;
  deliberationId?: string;
  types?: ContributionType[];
}) {
  const where: {
    deliberationId?: string;
    type?: { in: ContributionType[] };
  } = {};

  if (options?.deliberationId) {
    where.deliberationId = options.deliberationId;
  }

  if (options?.types && options.types.length > 0) {
    where.type = { in: options.types };
  }

  return prisma.scholarContribution.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
    include: {
      user: { select: { id: true, name: true, image: true } },
      deliberation: { select: { id: true, title: true } },
      argument: { select: { id: true, text: true } },
    },
  });
}

/**
 * Calculate quality multiplier based on contribution type and details
 */
function calculateQualityMultiplier(
  type: ContributionType,
  details: ContributionDetails
): number {
  let multiplier = 1.0;

  switch (type) {
    case "ATTACK_INITIATED":
    case "DEFENSE_PROVIDED":
      // Bonus if attack/defense was successful
      if (details.outcomeSuccess) {
        multiplier = 1.5;
      }
      break;

    case "CONSENSUS_ACHIEVED":
      // Scale with consensus level
      if (details.consensusLevel !== undefined) {
        multiplier = 1 + details.consensusLevel * 0.5;
      }
      break;

    case "CITATION_RECEIVED":
      // Scale with citation count
      if (details.citationCount !== undefined) {
        multiplier = Math.min(1 + details.citationCount * 0.1, 3.0);
      }
      break;

    case "REVIEW_COMPLETED":
      // Could factor in review depth, timeliness, etc.
      multiplier = 1.0;
      break;

    default:
      multiplier = 1.0;
  }

  return multiplier;
}

/**
 * Update the outcome success for a contribution (e.g., when an attack succeeds)
 */
export async function updateContributionOutcome(
  contributionId: string,
  success: boolean
) {
  const contribution = await prisma.scholarContribution.findUnique({
    where: { id: contributionId },
  });

  if (!contribution) {
    throw new Error(`Contribution not found: ${contributionId}`);
  }

  const details = (contribution.details as ContributionDetails) || {};
  details.outcomeSuccess = success;

  // Recalculate quality multiplier
  const qualityMultiplier = calculateQualityMultiplier(
    contribution.type,
    details
  );

  await prisma.scholarContribution.update({
    where: { id: contributionId },
    data: {
      details: details as object,
      qualityMultiplier,
    },
  });

  // Update stats
  updateScholarStatsAsync(contribution.userId.toString()).catch(console.error);
}

/**
 * Async function to update scholar stats (to avoid circular dependency)
 */
async function updateScholarStatsAsync(userId: string) {
  // Dynamically import to avoid circular dependency
  const { recalculateScholarStats } = await import("./statsService");
  await recalculateScholarStats(userId);
}
