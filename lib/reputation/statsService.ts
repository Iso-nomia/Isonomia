/**
 * Service for calculating and aggregating scholar statistics
 * Phase 4.2: Argumentation-Based Reputation
 */

import { prisma } from "@/lib/prismaclient";
import { ScholarStatsSummary, ContributionDetails } from "./types";

/**
 * Recalculate all stats for a scholar
 */
export async function recalculateScholarStats(
  userId: string
): Promise<ScholarStatsSummary> {
  const userIdBigInt = BigInt(userId);

  // Get all contributions
  const contributions = await prisma.scholarContribution.findMany({
    where: { userId: userIdBigInt },
  });

  // Count by type
  const counts: Record<string, number> = {};
  const successCounts: Record<string, number> = {};

  contributions.forEach((c) => {
    counts[c.type] = (counts[c.type] || 0) + 1;

    // Track successes
    const details = c.details as ContributionDetails | null;
    if (details?.outcomeSuccess) {
      successCounts[c.type] = (successCounts[c.type] || 0) + 1;
    }
  });

  // Calculate stats
  const totalArguments = counts.ARGUMENT_CREATED || 0;
  const argumentsWithConsensus = counts.CONSENSUS_ACHIEVED || 0;

  const totalAttacks = counts.ATTACK_INITIATED || 0;
  const successfulAttacks = successCounts.ATTACK_INITIATED || 0;

  const totalDefenses = counts.DEFENSE_PROVIDED || 0;
  const successfulDefenses = successCounts.DEFENSE_PROVIDED || 0;

  const reviewsCompleted = counts.REVIEW_COMPLETED || 0;
  const blockingConcernsRaised = counts.BLOCKING_CONCERN_RAISED || 0;
  const concernsResolved = counts.CHALLENGE_RESOLVED || 0;

  // Count concessions received (others conceding to this user)
  const concessionsReceived = contributions.filter(
    (c) =>
      c.type === "CONCESSION_MADE" &&
      (c.details as ContributionDetails | null)?.targetUserId === userId
  ).length;
  const concessionsMade = counts.CONCESSION_MADE || 0;

  const citationCount = counts.CITATION_RECEIVED || 0;

  // Count downstream usage (others supporting this user's arguments)
  const downstreamUsage = contributions.filter(
    (c) =>
      c.type === "SUPPORT_GIVEN" &&
      (c.details as ContributionDetails | null)?.targetUserId === userId
  ).length;

  // Calculate rates
  const defenseSuccessRate =
    totalDefenses > 0 ? successfulDefenses / totalDefenses : 0;
  const attackPrecision =
    totalAttacks > 0 ? successfulAttacks / totalAttacks : 0;
  const consensusRate =
    totalArguments > 0 ? argumentsWithConsensus / totalArguments : 0;

  // Calculate review quality (placeholder formula)
  const reviewQuality = calculateReviewQuality(
    reviewsCompleted,
    blockingConcernsRaised,
    concernsResolved
  );

  // Calculate overall reputation
  const reputationScore = calculateReputationScore({
    totalArguments,
    consensusRate,
    defenseSuccessRate,
    attackPrecision,
    reviewsCompleted,
    reviewQuality,
    citationCount,
  });

  // Upsert stats
  await prisma.scholarStats.upsert({
    where: { userId: userIdBigInt },
    create: {
      userId: userIdBigInt,
      totalArguments,
      argumentsWithConsensus,
      totalAttacks,
      successfulAttacks,
      totalDefenses,
      successfulDefenses,
      reviewsCompleted,
      blockingConcernsRaised,
      concernsResolved,
      concessionsReceived,
      concessionsMade,
      citationCount,
      downstreamUsage,
      defenseSuccessRate,
      attackPrecision,
      consensusRate,
      reviewQuality,
      reputationScore,
      calculatedAt: new Date(),
    },
    update: {
      totalArguments,
      argumentsWithConsensus,
      totalAttacks,
      successfulAttacks,
      totalDefenses,
      successfulDefenses,
      reviewsCompleted,
      blockingConcernsRaised,
      concernsResolved,
      concessionsReceived,
      concessionsMade,
      citationCount,
      downstreamUsage,
      defenseSuccessRate,
      attackPrecision,
      consensusRate,
      reviewQuality,
      reputationScore,
      calculatedAt: new Date(),
    },
  });

  // Get user info for summary
  const user = await prisma.user.findUnique({
    where: { id: userIdBigInt },
    select: { name: true },
  });

  return {
    userId,
    userName: user?.name || "Unknown",
    totalArguments,
    argumentsWithConsensus,
    consensusRate,
    totalAttacks,
    successfulAttacks,
    attackPrecision,
    totalDefenses,
    successfulDefenses,
    defenseSuccessRate,
    reviewsCompleted,
    reviewQuality,
    citationCount,
    downstreamUsage,
    reputationScore,
  };
}

/**
 * Get scholar stats (without recalculating)
 */
export async function getScholarStats(
  userId: string
): Promise<ScholarStatsSummary | null> {
  const stats = await prisma.scholarStats.findUnique({
    where: { userId: BigInt(userId) },
    include: {
      user: { select: { name: true } },
    },
  });

  if (!stats) return null;

  return {
    userId: stats.userId.toString(),
    userName: stats.user.name || "Unknown",
    totalArguments: stats.totalArguments,
    argumentsWithConsensus: stats.argumentsWithConsensus,
    consensusRate: stats.consensusRate,
    totalAttacks: stats.totalAttacks,
    successfulAttacks: stats.successfulAttacks,
    attackPrecision: stats.attackPrecision,
    totalDefenses: stats.totalDefenses,
    successfulDefenses: stats.successfulDefenses,
    defenseSuccessRate: stats.defenseSuccessRate,
    reviewsCompleted: stats.reviewsCompleted,
    reviewQuality: stats.reviewQuality,
    citationCount: stats.citationCount,
    downstreamUsage: stats.downstreamUsage,
    reputationScore: stats.reputationScore,
  };
}

/**
 * Get or calculate scholar stats
 */
export async function getOrCalculateScholarStats(
  userId: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
): Promise<ScholarStatsSummary> {
  const existing = await prisma.scholarStats.findUnique({
    where: { userId: BigInt(userId) },
  });

  // If stats exist and are fresh enough, return them
  if (existing) {
    const age = Date.now() - existing.calculatedAt.getTime();
    if (age < maxAgeMs) {
      const user = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { name: true },
      });

      return {
        userId,
        userName: user?.name || "Unknown",
        totalArguments: existing.totalArguments,
        argumentsWithConsensus: existing.argumentsWithConsensus,
        consensusRate: existing.consensusRate,
        totalAttacks: existing.totalAttacks,
        successfulAttacks: existing.successfulAttacks,
        attackPrecision: existing.attackPrecision,
        totalDefenses: existing.totalDefenses,
        successfulDefenses: existing.successfulDefenses,
        defenseSuccessRate: existing.defenseSuccessRate,
        reviewsCompleted: existing.reviewsCompleted,
        reviewQuality: existing.reviewQuality,
        citationCount: existing.citationCount,
        downstreamUsage: existing.downstreamUsage,
        reputationScore: existing.reputationScore,
      };
    }
  }

  // Recalculate if stale or missing
  return recalculateScholarStats(userId);
}

/**
 * Get reputation leaderboard
 */
export async function getReputationLeaderboard(options?: {
  limit?: number;
  minContributions?: number;
}) {
  const stats = await prisma.scholarStats.findMany({
    where: options?.minContributions
      ? { totalArguments: { gte: options.minContributions } }
      : undefined,
    orderBy: { reputationScore: "desc" },
    take: options?.limit || 20,
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return stats.map((s, index) => ({
    rank: index + 1,
    userId: s.userId.toString(),
    userName: s.user.name || "Unknown",
    userImage: s.user.image,
    reputationScore: s.reputationScore,
    totalArguments: s.totalArguments,
    consensusRate: s.consensusRate,
    citationCount: s.citationCount,
  }));
}

/**
 * Get top contributors for a deliberation
 */
export async function getDeliberationContributors(
  deliberationId: string,
  limit: number = 10
) {
  const contributions = await prisma.scholarContribution.groupBy({
    by: ["userId"],
    where: { deliberationId },
    _count: { id: true },
    _sum: { baseWeight: true, qualityMultiplier: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  // Get user info
  const userIds = contributions.map((c) => c.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });

  type UserInfo = { id: bigint; name: string; image: string | null };
  const userMap = new Map<string, UserInfo>(
    users.map((u) => [u.id.toString(), u as UserInfo])
  );

  return contributions.map((c, index) => {
    const user = userMap.get(c.userId.toString());
    return {
      rank: index + 1,
      userId: c.userId.toString(),
      userName: user?.name || "Unknown",
      userImage: user?.image,
      contributionCount: c._count.id,
      totalWeight: (c._sum.baseWeight || 0) * (c._sum.qualityMultiplier || 1),
    };
  });
}

/**
 * Calculate review quality score
 */
function calculateReviewQuality(
  reviewsCompleted: number,
  blockingConcernsRaised: number,
  concernsResolved: number
): number {
  if (reviewsCompleted === 0) return 0;

  // Base score from volume (max 30 points)
  const volumeScore = Math.min(reviewsCompleted / 10, 1) * 30;

  // Score from raising meaningful concerns (max 40 points)
  // Capped at 50% to reward critical but not excessive blocking
  const concernScore =
    reviewsCompleted > 0
      ? Math.min(blockingConcernsRaised / reviewsCompleted, 0.5) * 40
      : 0;

  // Score from concerns being resolved - indicates constructive feedback (max 30 points)
  const resolutionScore =
    blockingConcernsRaised > 0
      ? (concernsResolved / blockingConcernsRaised) * 30
      : 15; // Neutral if no blocking concerns raised

  return volumeScore + concernScore + resolutionScore;
}

/**
 * Calculate overall reputation score
 */
function calculateReputationScore(params: {
  totalArguments: number;
  consensusRate: number;
  defenseSuccessRate: number;
  attackPrecision: number;
  reviewsCompleted: number;
  reviewQuality: number;
  citationCount: number;
}): number {
  const {
    totalArguments,
    consensusRate,
    defenseSuccessRate,
    attackPrecision,
    reviewsCompleted,
    reviewQuality,
    citationCount,
  } = params;

  // Volume component (max 25 points)
  // Logarithmic scale to prevent volume gaming
  const volumeScore = Math.min(Math.log10(totalArguments + 1) / 2, 1) * 25;

  // Quality component (max 25 points)
  // Weighted combination of success rates
  const qualityScore =
    (consensusRate * 0.4 + defenseSuccessRate * 0.3 + attackPrecision * 0.3) *
    25;

  // Review component (max 25 points)
  // Split between volume and quality
  const reviewVolumeScore = Math.min(reviewsCompleted / 20, 1) * 12.5;
  const reviewQualityScore = (reviewQuality / 100) * 12.5;
  const reviewScore = reviewVolumeScore + reviewQualityScore;

  // Impact component (max 25 points)
  // Based on citations received
  const impactScore = Math.min(Math.log10(citationCount + 1) / 1.7, 1) * 25;

  return volumeScore + qualityScore + reviewScore + impactScore;
}

/**
 * Bulk recalculate stats for multiple users
 */
export async function bulkRecalculateStats(userIds: string[]) {
  const results = await Promise.allSettled(
    userIds.map((userId) => recalculateScholarStats(userId))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { succeeded, failed, total: userIds.length };
}
