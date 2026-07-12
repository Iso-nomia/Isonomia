/**
 * Service for managing reviewer profiles
 * Phase 4.2: Argumentation-Based Reputation
 */

import { prisma } from "@/lib/prismaclient";
import { ReviewerProfileSummary } from "./types";

/**
 * Update reviewer profile after review completion
 */
export async function updateReviewerProfile(
  userId: string,
  reviewData: {
    reviewId: string;
    commitmentCount: number;
    hasBlockingConcerns: boolean;
    completedOnTime: boolean;
    responseDays: number;
    topicArea?: string;
  }
) {
  const userIdBigInt = BigInt(userId);

  // Get current profile or create
  const existing = await prisma.reviewerProfile.findUnique({
    where: { userId: userIdBigInt },
  });

  const totalReviews = (existing?.totalReviews || 0) + 1;
  const completedOnTime =
    (existing?.completedOnTime || 0) + (reviewData.completedOnTime ? 1 : 0);

  // Update running averages
  const prevAvgCommitments = existing?.averageCommitments || 0;
  const newAvgCommitments =
    (prevAvgCommitments * (totalReviews - 1) + reviewData.commitmentCount) /
    totalReviews;

  const prevBlockingRate = existing?.blockingConcernRate || 0;
  const newBlockingRate =
    (prevBlockingRate * (totalReviews - 1) +
      (reviewData.hasBlockingConcerns ? 1 : 0)) /
    totalReviews;

  const prevAvgDays = existing?.averageResponseDays || 0;
  const newAvgDays =
    (prevAvgDays * (totalReviews - 1) + reviewData.responseDays) / totalReviews;

  // Update specialties
  type Specialty = { topicArea: string; reviewCount: number };
  let topSpecialties: Specialty[] = (existing?.topSpecialties as Specialty[]) || [];

  if (reviewData.topicArea) {
    const specialtyIndex = topSpecialties.findIndex(
      (s) => s.topicArea === reviewData.topicArea
    );
    if (specialtyIndex >= 0) {
      topSpecialties[specialtyIndex].reviewCount++;
    } else {
      topSpecialties.push({ topicArea: reviewData.topicArea, reviewCount: 1 });
    }
    // Keep top 5
    topSpecialties = topSpecialties
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 5);
  }

  await prisma.reviewerProfile.upsert({
    where: { userId: userIdBigInt },
    create: {
      userId: userIdBigInt,
      totalReviews: 1,
      completedOnTime: reviewData.completedOnTime ? 1 : 0,
      averageCommitments: reviewData.commitmentCount,
      blockingConcernRate: reviewData.hasBlockingConcerns ? 1 : 0,
      averageResponseDays: reviewData.responseDays,
      topSpecialties: topSpecialties,
    },
    update: {
      totalReviews,
      completedOnTime,
      averageCommitments: newAvgCommitments,
      blockingConcernRate: newBlockingRate,
      averageResponseDays: newAvgDays,
      topSpecialties: topSpecialties,
    },
  });
}

/**
 * Update concern resolution rate
 */
export async function updateConcernResolution(
  userId: string,
  concernsRaised: number,
  concernsResolved: number
) {
  if (concernsRaised === 0) return;

  const userIdBigInt = BigInt(userId);
  const rate = concernsResolved / concernsRaised;

  const existing = await prisma.reviewerProfile.findUnique({
    where: { userId: userIdBigInt },
  });

  if (!existing) return;

  // Weighted average with existing
  const prevRate = existing.concernResolutionRate || 0;
  const prevWeight = existing.totalReviews - 1;
  const newRate = (prevRate * prevWeight + rate) / existing.totalReviews;

  await prisma.reviewerProfile.update({
    where: { userId: userIdBigInt },
    data: { concernResolutionRate: newRate },
  });
}

/**
 * Track invitation acceptance
 */
export async function trackInvitationResponse(
  userId: string,
  accepted: boolean,
  isRepeatInvitation: boolean
) {
  const userIdBigInt = BigInt(userId);

  const existing = await prisma.reviewerProfile.findUnique({
    where: { userId: userIdBigInt },
  });

  const totalInvitations = (existing?.totalReviews || 0) + 1;
  const acceptCount = accepted
    ? (existing?.totalReviews || 0) * (existing?.invitationAcceptRate || 0) + 1
    : (existing?.totalReviews || 0) * (existing?.invitationAcceptRate || 0);

  await prisma.reviewerProfile.upsert({
    where: { userId: userIdBigInt },
    create: {
      userId: userIdBigInt,
      invitationAcceptRate: accepted ? 1 : 0,
      repeatInvitations: isRepeatInvitation ? 1 : 0,
    },
    update: {
      invitationAcceptRate: acceptCount / totalInvitations,
      repeatInvitations: isRepeatInvitation
        ? { increment: 1 }
        : existing?.repeatInvitations || 0,
    },
  });
}

/**
 * Get reviewer profile
 */
export async function getReviewerProfile(
  userId: string
): Promise<ReviewerProfileSummary | null> {
  const profile = await prisma.reviewerProfile.findUnique({
    where: { userId: BigInt(userId) },
  });

  if (!profile) return null;

  // Parse specialties
  type Specialty = { topicArea: string; reviewCount: number };
  const topSpecialties = (profile.topSpecialties as Specialty[] | null) || [];

  return {
    userId: profile.userId.toString(),
    totalReviews: profile.totalReviews,
    completedOnTime: profile.completedOnTime,
    onTimeRate:
      profile.totalReviews > 0
        ? profile.completedOnTime / profile.totalReviews
        : 0,
    averageCommitments: profile.averageCommitments,
    blockingConcernRate: profile.blockingConcernRate,
    concernResolutionRate: profile.concernResolutionRate,
    averageResponseDays: profile.averageResponseDays,
    topSpecialties: topSpecialties.map((s) => ({
      topicArea: s.topicArea,
      reviewCount: s.reviewCount,
    })),
  };
}

/**
 * Get top reviewers
 */
export async function getTopReviewers(limit = 10) {
  const profiles = await prisma.reviewerProfile.findMany({
    where: { totalReviews: { gte: 3 } }, // At least 3 reviews
    orderBy: [{ concernResolutionRate: "desc" }, { totalReviews: "desc" }],
    take: limit,
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return profiles.map((p, index) => ({
    rank: index + 1,
    userId: p.userId.toString(),
    userName: p.user.name || "Unknown",
    userImage: p.user.image,
    totalReviews: p.totalReviews,
    onTimeRate: p.totalReviews > 0 ? p.completedOnTime / p.totalReviews : 0,
    concernResolutionRate: p.concernResolutionRate,
  }));
}

/**
 * Get reviewer statistics summary
 */
export async function getReviewerStatsSummary() {
  const stats = await prisma.reviewerProfile.aggregate({
    _count: { id: true },
    _avg: {
      totalReviews: true,
      averageCommitments: true,
      blockingConcernRate: true,
      concernResolutionRate: true,
      averageResponseDays: true,
    },
  });

  return {
    totalReviewers: stats._count.id,
    averageTotalReviews: stats._avg.totalReviews || 0,
    averageCommitments: stats._avg.averageCommitments || 0,
    averageBlockingConcernRate: stats._avg.blockingConcernRate || 0,
    averageConcernResolutionRate: stats._avg.concernResolutionRate || 0,
    averageResponseDays: stats._avg.averageResponseDays || 0,
  };
}
