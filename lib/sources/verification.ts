// lib/sources/verification.ts
// Phase 3.1: Source Verification System

import { prisma } from "@/lib/prismaclient";

// Define types locally to avoid Prisma client cache issues
export type SourceVerificationStatus = 
  | "unverified"
  | "verified"
  | "redirected"
  | "unavailable"
  | "broken"
  | "paywalled";

export interface VerificationResult {
  status: SourceVerificationStatus;
  httpStatus: number | null;
  canonicalUrl: string | null;
  contentHash?: string;
  error?: string;
}

/**
 * Verify a source by checking its URL or DOI
 */
export async function verifySource(source: {
  url?: string | null;
  doi?: string | null;
}): Promise<VerificationResult> {
  // Prioritize DOI resolution (more stable)
  if (source.doi) {
    return await verifyDoi(source.doi);
  }

  if (source.url) {
    return await verifyUrl(source.url);
  }

  return {
    status: "unverified",
    httpStatus: null,
    canonicalUrl: null,
  };
}

/**
 * Verify a URL by making a HEAD request and checking the response
 */
export async function verifyUrl(url: string): Promise<VerificationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "MeshBot/1.0 (https://mesh.app; evidence verification)",
      },
    });

    clearTimeout(timeout);

    const canonicalUrl = response.url; // Final URL after redirects
    const httpStatus = response.status;

    // Check for paywall indicators
    const isPaywalled = detectPaywall(response);

    // Determine status based on HTTP response
    let status: SourceVerificationStatus;
    if (isPaywalled) {
      status = "paywalled";
    } else if (httpStatus >= 200 && httpStatus < 300) {
      status = canonicalUrl !== url ? "redirected" : "verified";
    } else if (httpStatus >= 400 && httpStatus < 500) {
      status = "broken";
    } else {
      status = "unavailable";
    }

    return { status, httpStatus, canonicalUrl };
  } catch (error) {
    return {
      status: "unavailable",
      httpStatus: null,
      canonicalUrl: null,
      error: String(error),
    };
  }
}

/**
 * Verify a DOI by resolving it through doi.org
 */
export async function verifyDoi(doi: string): Promise<VerificationResult> {
  const doiUrl = `https://doi.org/${doi}`;
  const result = await verifyUrl(doiUrl);

  // DOIs that resolve are considered verified even if they redirect
  if (result.status === "redirected") {
    result.status = "verified";
  }

  return result;
}

/**
 * Detect if a response indicates a paywall
 */
function detectPaywall(response: Response): boolean {
  // Common paywall headers
  const paywallHeaders = ["x-paywall", "x-subscription-required"];

  for (const header of paywallHeaders) {
    if (response.headers.has(header)) return true;
  }

  // Check for common paywall domains
  const paywallDomains = [
    "jstor.org",
    "sciencedirect.com",
    "springer.com",
    "wiley.com",
    "tandfonline.com",
    "nature.com",
    "cell.com",
  ];

  try {
    const url = new URL(response.url);
    return paywallDomains.some((d) => url.hostname.includes(d));
  } catch {
    return false;
  }
}

/**
 * Append a status entry to the HTTP status history
 */
export function appendStatusHistory(
  history: unknown,
  status: number | null
): { status: number | null; checkedAt: string }[] {
  const arr = Array.isArray(history) ? history : [];
  arr.push({ status, checkedAt: new Date().toISOString() });
  // Keep last 10 entries
  return arr.slice(-10);
}

/**
 * Verify a source by ID and update the database
 */
export async function verifySourceById(sourceId: string): Promise<{
  success: boolean;
  status: SourceVerificationStatus;
  error?: string;
}> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      url: true,
      doi: true,
      contentHash: true,
      httpStatusHistory: true,
    },
  });

  if (!source) {
    return { success: false, status: "unverified", error: "Source not found" };
  }

  const result = await verifySource(source);

  const contentChanged =
    source.contentHash &&
    result.contentHash &&
    source.contentHash !== result.contentHash;

  await prisma.source.update({
    where: { id: sourceId },
    data: {
      verificationStatus: result.status,
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
      canonicalUrl: result.canonicalUrl,
      httpStatus: result.httpStatus,
      httpStatusHistory: appendStatusHistory(
        source.httpStatusHistory,
        result.httpStatus
      ),
      contentHash: result.contentHash ?? source.contentHash,
      contentChangedAt: contentChanged ? new Date() : undefined,
    },
  });

  return {
    success: true,
    status: result.status,
    error: result.error,
  };
}

/**
 * Get sources that need re-verification (not checked in 7+ days)
 * Uses raw query to handle potential Prisma type cache issues
 */
export async function getStaleSourcesForReverification(
  limit: number = 100
): Promise<{ id: string }[]> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7);

  // Use raw query to avoid Prisma type cache issues with new fields
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Source"
    WHERE "lastCheckedAt" IS NULL 
       OR "lastCheckedAt" < ${staleThreshold}
    ORDER BY "lastCheckedAt" ASC NULLS FIRST
    LIMIT ${limit}
  `;
  
  return results;
}
