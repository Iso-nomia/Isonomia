// lib/sources/retractionCheck.ts
// Phase 3.1: Retraction and Correction Detection
// Checks CrossRef and Retraction Watch for retracted/corrected publications

import { prisma } from "@/lib/prismaclient";

// Types matching the schema enums
export type RetractionStatus = 
  | "none"
  | "retracted"
  | "expression_of_concern"
  | "partial_retraction";

export type CorrectionStatus =
  | "none"
  | "minor_correction"
  | "major_correction"
  | "erratum";

export interface RetractionResult {
  isRetracted: boolean;
  status: RetractionStatus;
  reason?: string;
  noticeUrl?: string;
  date?: Date;
}

export interface CorrectionResult {
  hasCorrectionUrl: boolean;
  status: CorrectionStatus;
  correctionUrl?: string;
  correctionDate?: Date;
  summary?: string;
}

export interface RetractionCheckResult {
  retraction: RetractionResult;
  correction: CorrectionResult;
}

/**
 * Check CrossRef for retraction/correction metadata
 * This is the primary source for DOI-based sources
 */
export async function checkCrossRefRetraction(doi: string): Promise<RetractionCheckResult> {
  const defaultResult: RetractionCheckResult = {
    retraction: { isRetracted: false, status: "none" },
    correction: { hasCorrectionUrl: false, status: "none" },
  };

  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: {
          "User-Agent": "MeshBot/1.0 (mailto:support@mesh.app; evidence verification)",
        },
      }
    );

    if (!response.ok) {
      return defaultResult;
    }

    const data = await response.json();
    const work = data.message;

    const result = { ...defaultResult };

    // Check for retraction relation
    if (work.relation) {
      // is-retracted-by indicates this work has been retracted
      if (work.relation["is-retracted-by"]) {
        const retraction = work.relation["is-retracted-by"][0];
        result.retraction = {
          isRetracted: true,
          status: "retracted",
          noticeUrl: retraction["id-type"] === "doi" 
            ? `https://doi.org/${retraction.id}`
            : retraction.id,
        };
      }

      // has-expression-of-concern indicates an EOC was issued
      if (work.relation["has-expression-of-concern"]) {
        const eoc = work.relation["has-expression-of-concern"][0];
        result.retraction = {
          isRetracted: true,
          status: "expression_of_concern",
          noticeUrl: eoc["id-type"] === "doi"
            ? `https://doi.org/${eoc.id}`
            : eoc.id,
        };
      }

      // is-corrected-by indicates a correction exists
      if (work.relation["is-corrected-by"]) {
        const correction = work.relation["is-corrected-by"][0];
        result.correction = {
          hasCorrectionUrl: true,
          status: "erratum", // CrossRef doesn't distinguish severity
          correctionUrl: correction["id-type"] === "doi"
            ? `https://doi.org/${correction.id}`
            : correction.id,
        };
      }
    }

    // Check update-to field (used by some publishers)
    if (work["update-to"]) {
      for (const update of work["update-to"]) {
        if (update.type === "retraction") {
          result.retraction = {
            isRetracted: true,
            status: "retracted",
            date: update.updated?.["date-time"] 
              ? new Date(update.updated["date-time"])
              : undefined,
          };
        } else if (update.type === "correction" || update.type === "erratum") {
          result.correction = {
            hasCorrectionUrl: true,
            status: update.type === "erratum" ? "erratum" : "major_correction",
            correctionDate: update.updated?.["date-time"]
              ? new Date(update.updated["date-time"])
              : undefined,
          };
        }
      }
    }

    return result;
  } catch (error) {
    console.error("[retractionCheck] CrossRef check failed:", error);
    return defaultResult;
  }
}

/**
 * Check Retraction Watch Database
 * Requires API key from retractiondatabase.org
 * Falls back gracefully if no API key configured
 */
export async function checkRetractionWatch(doi: string): Promise<RetractionResult> {
  const apiKey = process.env.RETRACTION_WATCH_API_KEY;
  
  // Gracefully skip if no API key
  if (!apiKey) {
    return { isRetracted: false, status: "none" };
  }

  try {
    const response = await fetch(
      `https://api.retractiondatabase.org/api/v1/record?doi=${encodeURIComponent(doi)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return { isRetracted: false, status: "none" };
    }

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      return {
        isRetracted: true,
        status: mapRetractionType(record.RetractionNature),
        reason: record.Reason,
        noticeUrl: record.RetractionNoticeURL,
        date: record.RetractionDate ? new Date(record.RetractionDate) : undefined,
      };
    }

    return { isRetracted: false, status: "none" };
  } catch (error) {
    console.error("[retractionCheck] Retraction Watch check failed:", error);
    return { isRetracted: false, status: "none" };
  }
}

function mapRetractionType(nature?: string): RetractionStatus {
  if (!nature) return "retracted";
  
  const lower = nature.toLowerCase();
  if (lower.includes("expression of concern")) return "expression_of_concern";
  if (lower.includes("partial")) return "partial_retraction";
  return "retracted";
}

/**
 * Check all sources for retraction status
 * Combines CrossRef and Retraction Watch results
 */
export async function checkSourceRetraction(sourceId: string): Promise<RetractionCheckResult | null> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { id: true, doi: true },
  });

  if (!source?.doi) {
    return null; // Can only check DOI-based sources
  }

  // Check CrossRef first (free, no API key required)
  const crossRefResult = await checkCrossRefRetraction(source.doi);

  // If CrossRef shows retraction, we're done
  if (crossRefResult.retraction.isRetracted) {
    await updateSourceRetractionStatus(sourceId, crossRefResult);
    return crossRefResult;
  }

  // Also check Retraction Watch for more comprehensive data
  const rwResult = await checkRetractionWatch(source.doi);
  
  if (rwResult.isRetracted) {
    const combined: RetractionCheckResult = {
      retraction: rwResult,
      correction: crossRefResult.correction,
    };
    await updateSourceRetractionStatus(sourceId, combined);
    return combined;
  }

  // No retraction found, but still update the check timestamp
  await prisma.source.update({
    where: { id: sourceId },
    data: { retractionCheckedAt: new Date() },
  });

  return crossRefResult;
}

/**
 * Update source with retraction/correction status
 */
async function updateSourceRetractionStatus(
  sourceId: string,
  result: RetractionCheckResult
): Promise<void> {
  await prisma.source.update({
    where: { id: sourceId },
    data: {
      retractionStatus: result.retraction.status,
      retractionCheckedAt: new Date(),
      retractionNoticeUrl: result.retraction.noticeUrl,
      retractionReason: result.retraction.reason,
      retractionDate: result.retraction.date,
      correctionStatus: result.correction.status,
      correctionUrl: result.correction.correctionUrl,
      correctionDate: result.correction.correctionDate,
      correctionSummary: result.correction.summary,
    },
  });
}

/**
 * Get sources that need retraction re-checking
 * Checks sources with DOIs that haven't been checked in the last 7 days
 */
export async function getSourcesForRetractionCheck(limit: number = 100): Promise<string[]> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7);

  const sources = await prisma.source.findMany({
    where: {
      doi: { not: null },
      OR: [
        { retractionCheckedAt: null },
        { retractionCheckedAt: { lt: staleThreshold } },
      ],
    },
    select: { id: true },
    take: limit,
    orderBy: { retractionCheckedAt: "asc" },
  });

  return sources.map((s) => s.id);
}
