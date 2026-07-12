/**
 * Phase 4.3: Institutional Report Service
 * Generates aggregate reports for institutions and departments
 */

import { prisma } from "@/lib/prismaclient";
import { InstitutionalReportData, InstitutionalReportType } from "./types";

/**
 * Generate institutional report
 */
export async function generateInstitutionalReport(
  reportType: InstitutionalReportType,
  options: {
    institutionId?: string;
    departmentId?: string;
    startDate: Date;
    endDate: Date;
  }
): Promise<InstitutionalReportData> {
  const { institutionId, startDate, endDate } = options;

  // Get users in scope — if no institution filter, get all users with contributions
  const users = await prisma.user.findMany({
    where: institutionId
      ? {
          scholarContributions: {
            some: {
              createdAt: { gte: startDate, lte: endDate },
            },
          },
        }
      : {
          scholarContributions: {
            some: {
              createdAt: { gte: startDate, lte: endDate },
            },
          },
        },
    select: { id: true, name: true },
  });

  const userIds = users.map((u) => u.id);
  const userMap = new Map(users.map((u) => [u.id.toString(), u.name || "Unknown"]));

  // Get contributions in period
  const contributions = await prisma.scholarContribution.findMany({
    where: {
      userId: { in: userIds },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Aggregate by type
  const byType: Record<string, number> = {};
  contributions.forEach((c) => {
    byType[c.type] = (byType[c.type] || 0) + 1;
  });

  // Get per-user counts
  const userCounts: Record<string, number> = {};
  contributions.forEach((c) => {
    const key = c.userId.toString();
    userCounts[key] = (userCounts[key] || 0) + 1;
  });

  // Get stats for scoring
  const stats = await prisma.scholarStats.findMany({
    where: { userId: { in: userIds } },
  });

  const scoreMap = new Map(
    stats.map((s) => [s.userId.toString(), s.reputationScore])
  );

  // Build top contributors
  const topContributors = Object.entries(userCounts)
    .map(([userIdStr, count]) => ({
      userId: BigInt(userIdStr),
      name: userMap.get(userIdStr) || "Unknown",
      count,
      score: scoreMap.get(userIdStr) || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Impact metrics
  const totalCitations = stats.reduce((sum, s) => sum + s.citationCount, 0);
  const consensusAchieved = byType["CONSENSUS_ACHIEVED"] || 0;
  const reviewsCompleted = byType["REVIEW_COMPLETED"] || 0;

  const reportData: InstitutionalReportData = {
    period: { start: startDate, end: endDate },
    totalContributors: new Set(contributions.map((c) => c.userId.toString())).size,
    totalContributions: contributions.length,
    byType,
    topContributors,
    impactMetrics: {
      totalCitations,
      consensusAchieved,
      reviewsCompleted,
    },
  };

  // Store report
  await prisma.institutionalReport.create({
    data: {
      institutionId: institutionId || null,
      departmentId: options.departmentId || null,
      startDate,
      endDate,
      reportType,
      data: serializeReportData(reportData),
      summary: generateReportSummary(reportData),
      generatedBy: "system",
    },
  });

  return reportData;
}

/**
 * Serialize report data for JSON storage (handles BigInt)
 */
function serializeReportData(data: InstitutionalReportData): object {
  return {
    ...data,
    topContributors: data.topContributors.map((tc) => ({
      ...tc,
      userId: tc.userId.toString(),
    })),
  };
}

/**
 * Generate human-readable summary
 */
function generateReportSummary(data: InstitutionalReportData): string {
  const periodStr = `${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}`;

  return `Report Period: ${periodStr}

Overview:
- ${data.totalContributors} active contributors
- ${data.totalContributions} total contributions

Impact Metrics:
- ${data.impactMetrics.totalCitations} citations received
- ${data.impactMetrics.consensusAchieved} consensus positions reached
- ${data.impactMetrics.reviewsCompleted} peer reviews completed

Top Contributor: ${data.topContributors[0]?.name || "N/A"} with ${data.topContributors[0]?.count || 0} contributions`;
}

/**
 * Get previous reports
 */
export async function getInstitutionalReports(
  institutionId?: string,
  limit = 10
) {
  return prisma.institutionalReport.findMany({
    where: institutionId ? { institutionId } : {},
    orderBy: { generatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get a single report by ID
 */
export async function getInstitutionalReportById(reportId: string) {
  return prisma.institutionalReport.findUnique({
    where: { id: reportId },
  });
}

/**
 * Get comparative stats between periods
 */
export async function getComparativeStats(
  institutionId: string,
  currentPeriod: { start: Date; end: Date },
  previousPeriod: { start: Date; end: Date }
) {
  const [current, previous] = await Promise.all([
    generateInstitutionalReport("INSTITUTION_OVERVIEW", {
      institutionId,
      startDate: currentPeriod.start,
      endDate: currentPeriod.end,
    }),
    generateInstitutionalReport("INSTITUTION_OVERVIEW", {
      institutionId,
      startDate: previousPeriod.start,
      endDate: previousPeriod.end,
    }),
  ]);

  return {
    current,
    previous,
    changes: {
      contributionsChange:
        ((current.totalContributions - previous.totalContributions) /
          (previous.totalContributions || 1)) *
        100,
      contributorsChange:
        ((current.totalContributors - previous.totalContributors) /
          (previous.totalContributors || 1)) *
        100,
      citationsChange:
        ((current.impactMetrics.totalCitations -
          previous.impactMetrics.totalCitations) /
          (previous.impactMetrics.totalCitations || 1)) *
        100,
    },
  };
}
