// lib/sources/archiving.ts
// Phase 3.1: Source Archiving System - Wayback Machine Integration

import { prisma } from "@/lib/prismaclient";

// Define type locally to avoid Prisma client cache issues
export type ArchiveStatus =
  | "none"
  | "pending"
  | "in_progress"
  | "archived"
  | "failed"
  | "exists";

const WAYBACK_CHECK_URL = "https://archive.org/wayback/available";
const WAYBACK_SAVE_URL = "https://web.archive.org/save/";

export interface WaybackResult {
  success: boolean;
  archiveUrl?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Check if a URL is already archived in Wayback Machine
 */
export async function checkWaybackArchive(url: string): Promise<WaybackResult> {
  try {
    const response = await fetch(
      `${WAYBACK_CHECK_URL}?url=${encodeURIComponent(url)}`,
      {
        headers: {
          "User-Agent": "MeshBot/1.0 (https://mesh.app; evidence archiving)",
        },
      }
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data.archived_snapshots?.closest?.available) {
      return {
        success: true,
        archiveUrl: data.archived_snapshots.closest.url,
        timestamp: data.archived_snapshots.closest.timestamp,
      };
    }

    return { success: false };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Request a new archive snapshot via Wayback Machine Save Page Now
 */
export async function requestWaybackArchive(
  url: string
): Promise<WaybackResult> {
  try {
    // First check if recent archive exists (within last 30 days)
    const existing = await checkWaybackArchive(url);
    if (existing.success && existing.timestamp) {
      const archiveDate = parseWaybackTimestamp(existing.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (archiveDate > thirtyDaysAgo) {
        return { ...existing, success: true };
      }
    }

    // Request new archive using the SPN2 endpoint
    const response = await fetch(`${WAYBACK_SAVE_URL}${url}`, {
      method: "GET",
      headers: {
        "User-Agent": "MeshBot/1.0 (https://mesh.app; evidence archiving)",
      },
      redirect: "follow",
    });

    if (response.ok || response.status === 302) {
      // Wayback returns the archive URL in headers or the final URL
      const archiveUrl =
        response.headers.get("Content-Location") ||
        response.headers.get("Location") ||
        response.url;

      return {
        success: true,
        archiveUrl: archiveUrl.startsWith("http")
          ? archiveUrl
          : `https://web.archive.org${archiveUrl}`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Parse Wayback Machine timestamp format (YYYYMMDDHHMMSS)
 */
function parseWaybackTimestamp(timestamp: string): Date {
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(8, 10) || "00";
  const minute = timestamp.slice(10, 12) || "00";
  const second = timestamp.slice(12, 14) || "00";

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

/**
 * Archive a source by ID
 */
export async function archiveSourceById(sourceId: string): Promise<{
  success: boolean;
  status: ArchiveStatus;
  archiveUrl?: string;
  error?: string;
}> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { id: true, url: true, doi: true, archiveUrl: true },
  });

  if (!source) {
    return { success: false, status: "failed", error: "Source not found" };
  }

  // If already archived, return existing
  if (source.archiveUrl) {
    return {
      success: true,
      status: "exists",
      archiveUrl: source.archiveUrl,
    };
  }

  // Determine URL to archive (prefer DOI link for stability)
  const urlToArchive = source.doi
    ? `https://doi.org/${source.doi}`
    : source.url;

  if (!urlToArchive) {
    return {
      success: false,
      status: "failed",
      error: "Source has no URL or DOI",
    };
  }

  // Update status to pending
  await prisma.source.update({
    where: { id: sourceId },
    data: {
      archiveStatus: "pending",
      archiveRequestedAt: new Date(),
    },
  });

  try {
    // First check for existing archive
    const existing = await checkWaybackArchive(urlToArchive);
    if (existing.success && existing.archiveUrl) {
      await prisma.source.update({
        where: { id: sourceId },
        data: {
          archiveStatus: "exists",
          archiveUrl: existing.archiveUrl,
          archivedAt: existing.timestamp
            ? parseWaybackTimestamp(existing.timestamp)
            : new Date(),
          archiveError: null,
        },
      });

      return {
        success: true,
        status: "exists",
        archiveUrl: existing.archiveUrl,
      };
    }

    // Request new archive
    const result = await requestWaybackArchive(urlToArchive);

    if (result.success && result.archiveUrl) {
      await prisma.source.update({
        where: { id: sourceId },
        data: {
          archiveStatus: "archived",
          archiveUrl: result.archiveUrl,
          archivedAt: new Date(),
          archiveError: null,
        },
      });

      return {
        success: true,
        status: "archived",
        archiveUrl: result.archiveUrl,
      };
    }

    // Archive failed
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        archiveStatus: "failed",
        archiveError: result.error || "Unknown error",
      },
    });

    return {
      success: false,
      status: "failed",
      error: result.error,
    };
  } catch (error) {
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        archiveStatus: "failed",
        archiveError: String(error),
      },
    });

    return {
      success: false,
      status: "failed",
      error: String(error),
    };
  }
}

/**
 * Get sources that need archiving (never archived)
 */
export async function getUnarchiveSourcesForProcessing(
  limit: number = 100
): Promise<{ id: string; url: string | null }[]> {
  return prisma.source.findMany({
    where: {
      archiveStatus: "none",
      OR: [{ url: { not: null } }, { doi: { not: null } }],
    },
    select: { id: true, url: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}
