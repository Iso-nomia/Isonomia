export const dynamic = "force-dynamic";

/**
 * API Route: Latest Release
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * GET /api/deliberations/[id]/releases/latest - Get the most recent release
 */

import { NextRequest, NextResponse } from "next/server";
import { getLatestRelease } from "@/lib/releases";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    const release = await getLatestRelease(deliberationId);

    if (!release) {
      return NextResponse.json(
        { error: "No releases found for this deliberation" },
        { status: 404 }
      );
    }

    // Check query params for detail level
    const url = new URL(req.url);
    const includeSnapshots = url.searchParams.get("includeSnapshots") === "true";

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

    if (release.changelog) {
      response.changelog = {
        summary: release.changelog.summary,
        text: release.changelogText,
      };
    }

    if (includeSnapshots) {
      response.claimSnapshot = release.claimSnapshot;
      response.argumentSnapshot = release.argumentSnapshot;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/releases/latest] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest release" },
      { status: 500 }
    );
  }
}
