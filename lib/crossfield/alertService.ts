/**
 * Phase 5.1: Service for cross-field discovery alerts
 */

import { prisma } from "@/lib/prismaclient";
import {
  CrossFieldAlertStatus,
  CrossFieldAlertData,
  CrossFieldAlertType,
} from "./types";

/**
 * Create cross-field alert
 */
export async function createAlert(
  userId: bigint,
  data: {
    alertType: CrossFieldAlertType;
    title: string;
    description: string;
    sourceField?: string;
    targetField?: string;
    matchScore?: number;
    sourceClaimId?: string;
    targetClaimId?: string;
    conceptId?: string;
    equivalenceId?: string;
  }
): Promise<CrossFieldAlertData> {
  const alert = await prisma.crossFieldAlert.create({
    data: {
      userId,
      alertType: data.alertType,
      title: data.title,
      description: data.description,
      sourceField: data.sourceField,
      targetField: data.targetField,
      matchScore: data.matchScore,
      sourceClaimId: data.sourceClaimId,
      targetClaimId: data.targetClaimId,
      conceptId: data.conceptId,
      equivalenceId: data.equivalenceId,
      status: "UNREAD",
    },
  });

  return {
    id: alert.id,
    alertType: alert.alertType as CrossFieldAlertType,
    title: alert.title,
    description: alert.description,
    sourceField: alert.sourceField || undefined,
    targetField: alert.targetField || undefined,
    matchScore: alert.matchScore || undefined,
    sourceClaimId: alert.sourceClaimId || undefined,
    targetClaimId: alert.targetClaimId || undefined,
    conceptId: alert.conceptId || undefined,
    status: alert.status as CrossFieldAlertStatus,
    createdAt: alert.createdAt,
  };
}

/**
 * Get user's alerts
 */
export async function getUserAlerts(
  userId: bigint,
  options?: {
    status?: CrossFieldAlertStatus;
    types?: CrossFieldAlertType[];
    limit?: number;
    offset?: number;
  }
): Promise<{ alerts: CrossFieldAlertData[]; total: number }> {
  const where: any = { userId };

  if (options?.status) {
    where.status = options.status;
  }
  if (options?.types && options.types.length > 0) {
    where.alertType = { in: options.types };
  }

  const [alerts, total] = await Promise.all([
    prisma.crossFieldAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    }),
    prisma.crossFieldAlert.count({ where }),
  ]);

  return {
    alerts: alerts.map((a) => ({
      id: a.id,
      alertType: a.alertType as CrossFieldAlertType,
      title: a.title,
      description: a.description,
      sourceField: a.sourceField || undefined,
      targetField: a.targetField || undefined,
      matchScore: a.matchScore || undefined,
      sourceClaimId: a.sourceClaimId || undefined,
      targetClaimId: a.targetClaimId || undefined,
      conceptId: a.conceptId || undefined,
      status: a.status as CrossFieldAlertStatus,
      createdAt: a.createdAt,
    })),
    total,
  };
}

/**
 * Mark alert as read
 */
export async function markAlertRead(alertId: string): Promise<void> {
  await prisma.crossFieldAlert.update({
    where: { id: alertId },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });
}

/**
 * Mark alert as actioned
 */
export async function markAlertActioned(alertId: string): Promise<void> {
  await prisma.crossFieldAlert.update({
    where: { id: alertId },
    data: {
      status: "ACTIONED",
      actionedAt: new Date(),
    },
  });
}

/**
 * Dismiss alert
 */
export async function dismissAlert(alertId: string): Promise<void> {
  await prisma.crossFieldAlert.update({
    where: { id: alertId },
    data: { status: "DISMISSED" },
  });
}

/**
 * Get unread alert count
 */
export async function getUnreadAlertCount(userId: bigint): Promise<number> {
  return prisma.crossFieldAlert.count({
    where: { userId, status: "UNREAD" },
  });
}

/**
 * Generate similar claim alerts for users with expertise in related fields.
 * Called when new claims are created in monitored fields.
 */
export async function generateSimilarClaimAlerts(
  claimId: string,
  claimFieldId: string,
  claimText: string
): Promise<number> {
  // Find users with high expertise linked to this field
  const interestedExperts = await prisma.scholarExpertise.findMany({
    where: {
      academicFieldId: claimFieldId,
      expertiseLevel: { in: ["ESTABLISHED", "EXPERT", "AUTHORITY"] },
    },
    select: { userId: true },
  });

  if (interestedExperts.length === 0) return 0;

  // Get claims from those users in OTHER fields
  const userIds = interestedExperts.map((u) => u.userId);
  const userClaims = await prisma.claim.findMany({
    where: {
      createdById: { in: userIds.map((id) => id.toString()) },
      academicFieldId: { not: claimFieldId },
    },
    include: { academicField: true },
    take: 100,
  });

  let alertCount = 0;

  for (const userClaim of userClaims) {
    const similarity = jaccardSimilarity(claimText, userClaim.text);

    if (similarity > 0.2) {
      const fieldName = userClaim.academicField?.name || "another field";
      await createAlert(BigInt(userClaim.createdById), {
        alertType: "SIMILAR_CLAIM",
        title: `Similar claim found in ${fieldName}`,
        description: `A claim appears related to your work: "${claimText.substring(0, 100)}..."`,
        sourceField: userClaim.academicFieldId || undefined,
        targetField: claimFieldId,
        matchScore: similarity,
        sourceClaimId: userClaim.id,
        targetClaimId: claimId,
      });
      alertCount++;
    }
  }

  return alertCount;
}

/**
 * Generate field discussion alerts for experts
 */
export async function generateFieldDiscussionAlert(
  fieldId: string,
  deliberationId: string,
  deliberationTitle: string
): Promise<number> {
  // Find experts in this field
  const experts = await prisma.scholarExpertise.findMany({
    where: {
      academicFieldId: fieldId,
      expertiseLevel: { in: ["EXPERT", "AUTHORITY"] },
    },
    select: { userId: true },
  });

  for (const expert of experts) {
    await createAlert(expert.userId, {
      alertType: "FIELD_DISCUSSION",
      title: "New discussion in your field",
      description: `A new deliberation "${deliberationTitle}" has started in your area of expertise.`,
      targetField: fieldId,
    });
  }

  return experts.length;
}

/**
 * Jaccard similarity between two texts (bag of words)
 */
function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const words2 = new Set(
    text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
