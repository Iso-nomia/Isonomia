export const dynamic = "force-dynamic";

/**
 * API Route: Single Release
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * GET /api/deliberations/[id]/releases/[releaseId] - Get a specific release
 * 
 * The releaseId can be either:
 * - A UUID (the release ID)
 * - A version string (e.g., "1.2.3" or "v1.2.3")
 */

import { NextRequest, NextResponse } from "next/server";
import { getRelease } from "@/lib/releases";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; releaseId: string } }
) {
  try {
    const { id: deliberationId, releaseId } = params;

    const release = await getRelease(deliberationId, releaseId);

    if (!release) {
      return NextResponse.json(
        { error: `Release not found: ${releaseId}` },
        { status: 404 }
      );
    }

    // Determine what level of detail to return
    const url = new URL(req.url);
    const includeSnapshots = url.searchParams.get("includeSnapshots") === "true";
    const includeChangelog = url.searchParams.get("includeChangelog") !== "false";

    const response: Record<string, unknown> = {
      id: release.id,
      deliberationId: release.deliberationId,
      version: release.version,
      versionMajor: release.versionMajor,
      versionMinor: release.versionMinor,
      versionPatch: release.versionPatch,
      title: release.title,
      description: release.description,
      citationUri: release.citationUri,
      bibtex: release.bibtex,
      createdAt: release.createdAt,
      createdById: release.createdById,
      stats: {
        claims: release.claimSnapshot.stats,
        arguments: release.argumentSnapshot.stats,
      },
    };

    if (includeChangelog && release.changelog) {
      response.changelog = {
        summary: release.changelog.summary,
        text: release.changelogText,
        details: release.changelog,
      };
    }

    if (includeSnapshots) {
      response.claimSnapshot = release.claimSnapshot;
      response.argumentSnapshot = release.argumentSnapshot;
      response.attackGraph = release.argumentSnapshot.attackGraph;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/releases/[releaseId]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch release" },
      { status: 500 }
    );
  }
}
