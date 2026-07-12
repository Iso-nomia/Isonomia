export const dynamic = "force-dynamic";

/**
 * API Route: Compare Releases
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * GET /api/deliberations/[id]/releases/compare?from=X&to=Y
 * 
 * Compare two releases and return the changelog between them.
 * from/to can be version strings (e.g., "1.0.0") or release IDs.
 */

import { NextRequest, NextResponse } from "next/server";
import { compareReleases } from "@/lib/releases";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const url = new URL(req.url);

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' query parameters are required" },
        { status: 400 }
      );
    }

    const comparison = await compareReleases(deliberationId, from, to);

    return NextResponse.json({
      from: {
        id: comparison.fromRelease.id,
        version: comparison.fromRelease.version,
        title: comparison.fromRelease.title,
        claimsCount: comparison.fromRelease.claimsCount,
        argumentsCount: comparison.fromRelease.argumentsCount,
        defendedCount: comparison.fromRelease.defendedCount,
      },
      to: {
        id: comparison.toRelease.id,
        version: comparison.toRelease.version,
        title: comparison.toRelease.title,
        claimsCount: comparison.toRelease.claimsCount,
        argumentsCount: comparison.toRelease.argumentsCount,
        defendedCount: comparison.toRelease.defendedCount,
      },
      changelog: {
        summary: comparison.changelog.summary,
        text: comparison.changelogText,
        claims: comparison.changelog.claims,
        arguments: comparison.changelog.arguments,
      },
    });
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/releases/compare] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to compare releases" },
      { status: 500 }
    );
  }
}
