/**
 * Claim Prediction Service
 * 
 * Service layer for managing claim predictions and outcomes.
 * Provides CRUD operations and business logic for the prediction system.
 */

import { prisma } from "@/lib/prismaclient";
import {
  ClaimPredictionStatus,
  PredictionResolution,
  EvidenceType,
  Prisma,
} from "@prisma/client";
import type {
  ClaimPrediction,
  PredictionOutcome,
  CreatePredictionInput,
  UpdatePredictionInput,
  ResolvePredictionInput,
  RecordOutcomeInput,
  GetPredictionsQuery,
  PredictionsListResponse,
  UserPredictionStats,
  ClaimPredictionSummary,
} from "@/lib/types/claim-prediction";

// ─────────────────────────────────────────────────────────
// Prediction Service
// ─────────────────────────────────────────────────────────

export const predictionService = {
  /**
   * Create a new prediction for a claim
   */
  async createPrediction(input: CreatePredictionInput): Promise<ClaimPrediction> {
    const {
      claimId,
      deliberationId,
      predictionText,
      targetDate,
      confidence = 0.5,
      createdById,
    } = input;

    // Clamp confidence to 0-1 range
    const clampedConfidence = Math.max(0, Math.min(1, confidence));

    // Parse target date if string
    const parsedTargetDate = targetDate
      ? typeof targetDate === "string"
        ? new Date(targetDate)
        : targetDate
      : null;

    // Create prediction and update claim counts in a transaction
    const prediction = await prisma.$transaction(async (tx) => {
      // Create the prediction
      const pred = await tx.claimPrediction.create({
        data: {
          claimId,
          deliberationId,
          predictionText,
          targetDate: parsedTargetDate,
          confidence: clampedConfidence,
          status: ClaimPredictionStatus.PENDING,
          createdById,
        },
        include: {
          outcomes: true,
        },
      });

      // Update claim counts
      await tx.claim.update({
        where: { id: claimId },
        data: {
          hasPredictions: true,
          predictionCount: { increment: 1 },
          pendingCount: { increment: 1 },
        },
      });

      return pred;
    });

    return prediction as ClaimPrediction;
  },

  /**
   * Get a single prediction by ID
   */
  async getPrediction(predictionId: string): Promise<ClaimPrediction | null> {
    const prediction = await prisma.claimPrediction.findUnique({
      where: { id: predictionId },
      include: {
        outcomes: {
          orderBy: { observedAt: "desc" },
        },
        claim: {
          select: { id: true, text: true },
        },
      },
    });

    return prediction as ClaimPrediction | null;
  },

  /**
   * Get predictions for a claim
   */
  async getPredictionsForClaim(
    claimId: string,
    status?: ClaimPredictionStatus
  ): Promise<ClaimPrediction[]> {
    const predictions = await prisma.claimPrediction.findMany({
      where: {
        claimId,
        ...(status && { status }),
      },
      include: {
        outcomes: {
          orderBy: { observedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return predictions as ClaimPrediction[];
  },

  /**
   * Get predictions for a deliberation with pagination
   */
  async getPredictionsForDeliberation(
    deliberationId: string,
    options: { status?: ClaimPredictionStatus; limit?: number; offset?: number } = {}
  ): Promise<PredictionsListResponse> {
    const { status, limit = 50, offset = 0 } = options;

    const where: Prisma.ClaimPredictionWhereInput = {
      deliberationId,
      ...(status && { status }),
    };

    const [predictions, total] = await Promise.all([
      prisma.claimPrediction.findMany({
        where,
        include: {
          outcomes: {
            orderBy: { observedAt: "desc" },
            take: 3, // Limit outcomes for list view
          },
          claim: {
            select: { id: true, text: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.claimPrediction.count({ where }),
    ]);

    return {
      predictions: predictions as ClaimPrediction[],
      total,
      hasMore: offset + predictions.length < total,
    };
  },

  /**
   * Update a prediction (only allowed for PENDING predictions)
   */
  async updatePrediction(input: UpdatePredictionInput): Promise<ClaimPrediction> {
    const { predictionId, predictionText, targetDate, confidence } = input;

    // Check prediction exists and is pending
    const existing = await prisma.claimPrediction.findUnique({
      where: { id: predictionId },
    });

    if (!existing) {
      throw new Error("Prediction not found");
    }

    if (existing.status !== ClaimPredictionStatus.PENDING) {
      throw new Error("Cannot update a non-pending prediction");
    }

    // Build update data
    const updateData: Prisma.ClaimPredictionUpdateInput = {};

    if (predictionText !== undefined) {
      updateData.predictionText = predictionText;
    }

    if (targetDate !== undefined) {
      updateData.targetDate = targetDate
        ? typeof targetDate === "string"
          ? new Date(targetDate)
          : targetDate
        : null;
    }

    if (confidence !== undefined) {
      updateData.confidence = Math.max(0, Math.min(1, confidence));
    }

    const prediction = await prisma.claimPrediction.update({
      where: { id: predictionId },
      data: updateData,
      include: {
        outcomes: true,
      },
    });

    return prediction as ClaimPrediction;
  },

  /**
   * Resolve a prediction with an outcome
   */
  async resolvePrediction(input: ResolvePredictionInput): Promise<ClaimPrediction> {
    const { predictionId, resolution, resolutionNote, resolvedById } = input;

    // Check prediction exists and is pending
    const existing = await prisma.claimPrediction.findUnique({
      where: { id: predictionId },
    });

    if (!existing) {
      throw new Error("Prediction not found");
    }

    if (existing.status === ClaimPredictionStatus.RESOLVED) {
      throw new Error("Prediction is already resolved");
    }

    if (existing.status === ClaimPredictionStatus.WITHDRAWN) {
      throw new Error("Cannot resolve a withdrawn prediction");
    }

    // Resolve prediction and update claim counts in a transaction
    const prediction = await prisma.$transaction(async (tx) => {
      // Update prediction status
      const pred = await tx.claimPrediction.update({
        where: { id: predictionId },
        data: {
          status: ClaimPredictionStatus.RESOLVED,
          resolution,
          resolutionNote,
          resolvedById,
          resolvedAt: new Date(),
        },
        include: {
          outcomes: true,
        },
      });

      // Prepare claim count updates
      const claimUpdate: Prisma.ClaimUpdateInput = {
        pendingCount: { decrement: 1 },
      };

      // Increment appropriate resolution count
      if (resolution === PredictionResolution.CONFIRMED) {
        claimUpdate.confirmedCount = { increment: 1 };
      } else if (resolution === PredictionResolution.DISCONFIRMED) {
        claimUpdate.disconfirmedCount = { increment: 1 };
      }

      // Update claim counts
      await tx.claim.update({
        where: { id: existing.claimId },
        data: claimUpdate,
      });

      return pred;
    });

    return prediction as ClaimPrediction;
  },

  /**
   * Withdraw a prediction (retract by creator)
   */
  async withdrawPrediction(
    predictionId: string,
    userId: string
  ): Promise<ClaimPrediction> {
    const existing = await prisma.claimPrediction.findUnique({
      where: { id: predictionId },
    });

    if (!existing) {
      throw new Error("Prediction not found");
    }

    if (existing.createdById !== userId) {
      throw new Error("Only the creator can withdraw a prediction");
    }

    if (existing.status !== ClaimPredictionStatus.PENDING) {
      throw new Error("Can only withdraw pending predictions");
    }

    const prediction = await prisma.$transaction(async (tx) => {
      const pred = await tx.claimPrediction.update({
        where: { id: predictionId },
        data: {
          status: ClaimPredictionStatus.WITHDRAWN,
        },
        include: {
          outcomes: true,
        },
      });

      // Update claim counts
      await tx.claim.update({
        where: { id: existing.claimId },
        data: {
          pendingCount: { decrement: 1 },
        },
      });

      return pred;
    });

    return prediction as ClaimPrediction;
  },

  /**
   * Record an outcome/evidence for a prediction
   */
  async recordOutcome(input: RecordOutcomeInput): Promise<PredictionOutcome> {
    const {
      predictionId,
      description,
      evidenceType = EvidenceType.OBSERVATION,
      evidenceUrl,
      observedAt,
      recordedById,
    } = input;

    // Verify prediction exists
    const prediction = await prisma.claimPrediction.findUnique({
      where: { id: predictionId },
    });

    if (!prediction) {
      throw new Error("Prediction not found");
    }

    if (prediction.status === ClaimPredictionStatus.WITHDRAWN) {
      throw new Error("Cannot record outcome for withdrawn prediction");
    }

    const parsedObservedAt = observedAt
      ? typeof observedAt === "string"
        ? new Date(observedAt)
        : observedAt
      : new Date();

    const outcome = await prisma.predictionOutcome.create({
      data: {
        predictionId,
        description,
        evidenceType,
        evidenceUrl,
        observedAt: parsedObservedAt,
        recordedById,
      },
    });

    return outcome as PredictionOutcome;
  },

  /**
   * Get outcomes for a prediction
   */
  async getOutcomes(predictionId: string): Promise<PredictionOutcome[]> {
    const outcomes = await prisma.predictionOutcome.findMany({
      where: { predictionId },
      orderBy: { observedAt: "desc" },
    });

    return outcomes as PredictionOutcome[];
  },

  /**
   * Get prediction statistics for a user
   */
  async getUserStats(userId: string): Promise<UserPredictionStats> {
    const predictions = await prisma.claimPrediction.findMany({
      where: { createdById: userId },
      select: {
        status: true,
        resolution: true,
        confidence: true,
      },
    });

    const stats: UserPredictionStats = {
      userId,
      totalPredictions: predictions.length,
      pendingCount: 0,
      resolvedCount: 0,
      confirmedCount: 0,
      disconfirmedCount: 0,
      partiallyTrueCount: 0,
      indeterminateCount: 0,
      withdrawnCount: 0,
      expiredCount: 0,
      accuracyRate: 0,
      averageConfidence: 0,
    };

    let totalConfidence = 0;

    for (const pred of predictions) {
      totalConfidence += pred.confidence;

      switch (pred.status) {
        case ClaimPredictionStatus.PENDING:
          stats.pendingCount++;
          break;
        case ClaimPredictionStatus.RESOLVED:
          stats.resolvedCount++;
          switch (pred.resolution) {
            case PredictionResolution.CONFIRMED:
              stats.confirmedCount++;
              break;
            case PredictionResolution.DISCONFIRMED:
              stats.disconfirmedCount++;
              break;
            case PredictionResolution.PARTIALLY_TRUE:
              stats.partiallyTrueCount++;
              break;
            case PredictionResolution.INDETERMINATE:
              stats.indeterminateCount++;
              break;
          }
          break;
        case ClaimPredictionStatus.WITHDRAWN:
          stats.withdrawnCount++;
          break;
        case ClaimPredictionStatus.EXPIRED:
          stats.expiredCount++;
          break;
      }
    }

    // Calculate accuracy rate (confirmed / (confirmed + disconfirmed))
    const totalResolved = stats.confirmedCount + stats.disconfirmedCount;
    stats.accuracyRate = totalResolved > 0 ? stats.confirmedCount / totalResolved : 0;

    // Calculate average confidence
    stats.averageConfidence =
      predictions.length > 0 ? totalConfidence / predictions.length : 0;

    return stats;
  },

  /**
   * Get prediction summary for a claim
   */
  async getClaimPredictionSummary(claimId: string): Promise<ClaimPredictionSummary> {
    const predictions = await prisma.claimPrediction.findMany({
      where: { claimId },
      select: {
        status: true,
        resolution: true,
      },
    });

    const summary: ClaimPredictionSummary = {
      claimId,
      totalPredictions: predictions.length,
      pendingCount: 0,
      confirmedCount: 0,
      disconfirmedCount: 0,
    };

    for (const pred of predictions) {
      if (pred.status === ClaimPredictionStatus.PENDING) {
        summary.pendingCount++;
      } else if (pred.status === ClaimPredictionStatus.RESOLVED) {
        if (pred.resolution === PredictionResolution.CONFIRMED) {
          summary.confirmedCount++;
        } else if (pred.resolution === PredictionResolution.DISCONFIRMED) {
          summary.disconfirmedCount++;
        }
      }
    }

    return summary;
  },

  /**
   * Mark expired predictions (for cron job)
   * Finds predictions past their target date that are still pending
   */
  async markExpiredPredictions(): Promise<number> {
    const now = new Date();

    const expiredPredictions = await prisma.claimPrediction.findMany({
      where: {
        status: ClaimPredictionStatus.PENDING,
        targetDate: {
          lt: now,
        },
      },
      select: {
        id: true,
        claimId: true,
      },
    });

    if (expiredPredictions.length === 0) {
      return 0;
    }

    // Group by claim for batch updates
    const claimIds = [...new Set(expiredPredictions.map((p) => p.claimId))];

    await prisma.$transaction(async (tx) => {
      // Update all expired predictions
      await tx.claimPrediction.updateMany({
        where: {
          id: { in: expiredPredictions.map((p) => p.id) },
        },
        data: {
          status: ClaimPredictionStatus.EXPIRED,
        },
      });

      // Update claim counts for each affected claim
      for (const claimId of claimIds) {
        const count = expiredPredictions.filter((p) => p.claimId === claimId).length;
        await tx.claim.update({
          where: { id: claimId },
          data: {
            pendingCount: { decrement: count },
          },
        });
      }
    });

    return expiredPredictions.length;
  },

  /**
   * Delete a prediction (only allowed for creator of PENDING predictions)
   */
  async deletePrediction(predictionId: string, userId: string): Promise<void> {
    const existing = await prisma.claimPrediction.findUnique({
      where: { id: predictionId },
    });

    if (!existing) {
      throw new Error("Prediction not found");
    }

    if (existing.createdById !== userId) {
      throw new Error("Only the creator can delete a prediction");
    }

    if (existing.status !== ClaimPredictionStatus.PENDING) {
      throw new Error("Can only delete pending predictions");
    }

    await prisma.$transaction(async (tx) => {
      // Delete the prediction (cascades to outcomes)
      await tx.claimPrediction.delete({
        where: { id: predictionId },
      });

      // Update claim counts
      await tx.claim.update({
        where: { id: existing.claimId },
        data: {
          predictionCount: { decrement: 1 },
          pendingCount: { decrement: 1 },
        },
      });

      // Check if claim still has predictions
      const remainingCount = await tx.claimPrediction.count({
        where: { claimId: existing.claimId },
      });

      if (remainingCount === 0) {
        await tx.claim.update({
          where: { id: existing.claimId },
          data: { hasPredictions: false },
        });
      }
    });
  },
};

export default predictionService;
