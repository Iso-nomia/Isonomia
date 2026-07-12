/**
 * Service for tracking scholar expertise areas
 * Phase 4.2: Argumentation-Based Reputation
 */

import { prisma } from "@/lib/prismaclient";
import { ExpertiseLevel, ExpertiseAreaSummary, EXPERTISE_THRESHOLDS } from "./types";

/**
 * Update expertise for a contribution in a topic area
 */
export async function trackExpertise(
  userId: string,
  topicArea: string,
  contributedToConsensus: boolean = false
) {
  if (!topicArea) return;

  const userIdBigInt = BigInt(userId);

  // Upsert expertise record
  const existing = await prisma.scholarExpertise.findUnique({
    where: { userId_topicArea: { userId: userIdBigInt, topicArea } },
  });

  if (existing) {
    const newContributionCount = existing.contributionCount + 1;
    const newConsensusContributions =
      existing.consensusContributions + (contributedToConsensus ? 1 : 0);

    await prisma.scholarExpertise.update({
      where: { userId_topicArea: { userId: userIdBigInt, topicArea } },
      data: {
        contributionCount: newContributionCount,
        consensusContributions: newConsensusContributions,
        lastContribution: new Date(),
        expertiseScore: calculateExpertiseScore(
          newContributionCount,
          newConsensusContributions
        ),
        expertiseLevel: getExpertiseLevel(newContributionCount),
      },
    });
  } else {
    await prisma.scholarExpertise.create({
      data: {
        userId: userIdBigInt,
        topicArea,
        contributionCount: 1,
        consensusContributions: contributedToConsensus ? 1 : 0,
        firstContribution: new Date(),
        lastContribution: new Date(),
        expertiseScore: calculateExpertiseScore(1, contributedToConsensus ? 1 : 0),
        expertiseLevel: getExpertiseLevel(1),
      },
    });
  }
}

/**
 * Get expertise areas for a user
 */
export async function getUserExpertise(
  userId: string
): Promise<ExpertiseAreaSummary[]> {
  const expertise = await prisma.scholarExpertise.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { expertiseScore: "desc" },
  });

  return expertise.map((e) => ({
    topicArea: e.topicArea,
    contributionCount: e.contributionCount,
    expertiseScore: e.expertiseScore,
    expertiseLevel: e.expertiseLevel as ExpertiseLevel,
  }));
}

/**
 * Get top experts for a topic area
 */
export async function getTopicExperts(
  topicArea: string,
  limit = 10
): Promise<
  Array<{
    userId: string;
    userName: string;
    expertiseLevel: ExpertiseLevel;
    contributionCount: number;
  }>
> {
  const experts = await prisma.scholarExpertise.findMany({
    where: { topicArea },
    orderBy: { expertiseScore: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return experts.map((e) => ({
    userId: e.userId.toString(),
    userName: e.user.name || "Unknown",
    expertiseLevel: e.expertiseLevel as ExpertiseLevel,
    contributionCount: e.contributionCount,
  }));
}

/**
 * Get all unique topic areas
 */
export async function getAllTopicAreas(): Promise<string[]> {
  const results = await prisma.scholarExpertise.findMany({
    select: { topicArea: true },
    distinct: ["topicArea"],
    orderBy: { topicArea: "asc" },
  });

  return results.map((r) => r.topicArea);
}

/**
 * Get expertise summary across all users for a topic
 */
export async function getTopicExpertiseSummary(topicArea: string) {
  const stats = await prisma.scholarExpertise.aggregate({
    where: { topicArea },
    _count: { id: true },
    _avg: { expertiseScore: true, contributionCount: true },
    _max: { expertiseScore: true, contributionCount: true },
  });

  const levelCounts = await prisma.scholarExpertise.groupBy({
    by: ["expertiseLevel"],
    where: { topicArea },
    _count: { id: true },
  });

  return {
    topicArea,
    totalExperts: stats._count.id,
    averageScore: stats._avg.expertiseScore || 0,
    averageContributions: stats._avg.contributionCount || 0,
    maxScore: stats._max.expertiseScore || 0,
    maxContributions: stats._max.contributionCount || 0,
    levelDistribution: Object.fromEntries(
      levelCounts.map((l) => [l.expertiseLevel, l._count.id])
    ),
  };
}

/**
 * Calculate expertise score
 */
function calculateExpertiseScore(
  contributionCount: number,
  consensusContributions: number
): number {
  // Volume score (logarithmic to prevent gaming) - max 40 points
  const volumeScore = Math.log10(contributionCount + 1) * 40;

  // Quality score (consensus rate) - max 60 points
  const qualityScore =
    contributionCount > 0
      ? (consensusContributions / contributionCount) * 60
      : 0;

  return Math.min(volumeScore + qualityScore, 100);
}

/**
 * Get expertise level from contribution count
 */
function getExpertiseLevel(contributionCount: number): ExpertiseLevel {
  if (contributionCount >= EXPERTISE_THRESHOLDS.AUTHORITY) return "AUTHORITY";
  if (contributionCount >= EXPERTISE_THRESHOLDS.EXPERT) return "EXPERT";
  if (contributionCount >= EXPERTISE_THRESHOLDS.ESTABLISHED) return "ESTABLISHED";
  if (contributionCount >= EXPERTISE_THRESHOLDS.CONTRIBUTOR) return "CONTRIBUTOR";
  return "NOVICE";
}

/**
 * Get expertise level info for display
 */
export function getExpertiseLevelInfo(level: ExpertiseLevel) {
  const info: Record<
    ExpertiseLevel,
    { minContributions: number; label: string; color: string }
  > = {
    NOVICE: { minContributions: 0, label: "Novice", color: "gray" },
    CONTRIBUTOR: { minContributions: 5, label: "Contributor", color: "blue" },
    ESTABLISHED: { minContributions: 20, label: "Established", color: "green" },
    EXPERT: { minContributions: 50, label: "Expert", color: "purple" },
    AUTHORITY: { minContributions: 100, label: "Authority", color: "gold" },
  };

  return info[level];
}
