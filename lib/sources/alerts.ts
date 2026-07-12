// lib/sources/alerts.ts
// Phase 3.1: Source Alert System
// Creates and manages alerts for source issues (retraction, broken links, etc.)

import { prisma } from "@/lib/prismaclient";

// Types matching schema enums
export type SourceAlertType =
  | "retraction"
  | "expression_of_concern"
  | "major_correction"
  | "link_broken"
  | "content_changed";

export interface CreateAlertOptions {
  sourceId: string;
  alertType: SourceAlertType;
  message: string;
  notifyUsers?: boolean; // Whether to create notifications for users who cited this source
}

/**
 * Create a new source alert
 * Optionally notifies all users who have cited this source
 */
export async function createSourceAlert(
  options: CreateAlertOptions
): Promise<string> {
  const { sourceId, alertType, message, notifyUsers = true } = options;

  // Create the alert
  const alert = await prisma.sourceAlert.create({
    data: {
      sourceId,
      alertType,
      message,
    },
  });

  // Find all users who have cited this source and create notifications
  if (notifyUsers) {
    await notifyUsersAboutAlert(alert.id, sourceId);
  }

  return alert.id;
}

/**
 * Find all users who have cited a source and create notifications
 */
async function notifyUsersAboutAlert(
  alertId: string,
  sourceId: string
): Promise<number> {
  // Find all unique users who have citations referencing this source
  // Citation has createdById field
  const citations = await prisma.citation.findMany({
    where: { sourceId },
    select: {
      createdById: true,
    },
  });

  // Get unique user IDs (as BigInt for compatibility with User.id)
  const userIds = new Set<string>();
  for (const citation of citations) {
    if (citation.createdById) {
      userIds.add(citation.createdById);
    }
  }

  // Convert string IDs to BigInt for database insert
  const notifications = Array.from(userIds).map((userId) => ({
    alertId,
    userId: BigInt(userId),
  }));

  if (notifications.length > 0) {
    await prisma.sourceAlertNotification.createMany({
      data: notifications,
      skipDuplicates: true,
    });
  }

  return notifications.length;
}

/**
 * Get pending alerts for a user (unseen, not dismissed)
 */
export async function getUserPendingAlerts(userId: string): Promise<any[]> {
  const notifications = await prisma.sourceAlertNotification.findMany({
    where: {
      userId: BigInt(userId),
      seenAt: null,
      dismissedAt: null,
    },
    include: {
      alert: {
        include: {
          source: {
            select: {
              id: true,
              title: true,
              url: true,
              doi: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications;
}

/**
 * Mark alert notification as seen
 */
export async function markAlertSeen(
  alertId: string,
  userId: string
): Promise<void> {
  await prisma.sourceAlertNotification.update({
    where: {
      alertId_userId: { alertId, userId: BigInt(userId) },
    },
    data: { seenAt: new Date() },
  });
}

/**
 * Dismiss alert notification
 */
export async function dismissAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await prisma.sourceAlertNotification.update({
    where: {
      alertId_userId: { alertId, userId: BigInt(userId) },
    },
    data: { dismissedAt: new Date() },
  });
}

/**
 * Get count of pending alerts for a user
 */
export async function getPendingAlertCount(userId: string): Promise<number> {
  return prisma.sourceAlertNotification.count({
    where: {
      userId: BigInt(userId),
      seenAt: null,
      dismissedAt: null,
    },
  });
}

/**
 * Create alert for broken source
 */
export async function alertBrokenSource(sourceId: string): Promise<string> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { title: true, url: true },
  });

  return createSourceAlert({
    sourceId,
    alertType: "link_broken",
    message: `The source "${source?.title || source?.url}" is no longer accessible. Consider finding an alternative or using the archived version.`,
  });
}

/**
 * Create alert for retracted source
 */
export async function alertRetractedSource(
  sourceId: string,
  reason?: string
): Promise<string> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { title: true, retractionNoticeUrl: true },
  });

  const message = reason
    ? `The source "${source?.title}" has been retracted: ${reason}`
    : `The source "${source?.title}" has been retracted. You may need to reconsider arguments that cite this source.`;

  return createSourceAlert({
    sourceId,
    alertType: "retraction",
    message,
  });
}

/**
 * Create alert for expression of concern
 */
export async function alertExpressionOfConcern(sourceId: string): Promise<string> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { title: true },
  });

  return createSourceAlert({
    sourceId,
    alertType: "expression_of_concern",
    message: `An expression of concern has been issued for "${source?.title}". The source's claims should be interpreted with caution.`,
  });
}

/**
 * Create alert for major correction
 */
export async function alertMajorCorrection(
  sourceId: string,
  summary?: string
): Promise<string> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { title: true, correctionUrl: true },
  });

  const message = summary
    ? `A major correction has been issued for "${source?.title}": ${summary}`
    : `A major correction has been issued for "${source?.title}". Review the correction to ensure your arguments remain valid.`;

  return createSourceAlert({
    sourceId,
    alertType: "major_correction",
    message,
  });
}
