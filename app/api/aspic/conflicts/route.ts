export const dynamic = "force-dynamic";

/**
 * Conflict detection API
 * GET: Detect conflicts in deliberation preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectConflicts, markConflictDetected } from "@/lib/aspic/conflicts/detection";
import { getResolutionHistory } from "@/lib/aspic/conflicts/resolution";
import { getUserFromCookies } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const ConflictQuery = z.object({
  deliberationId: z.string().min(6),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, ...NO_STORE }
    );
  }

  const url = new URL(req.url);
  const query = ConflictQuery.safeParse({
    deliberationId: url.searchParams.get("deliberationId"),
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: query.error.issues },
      { status: 400, ...NO_STORE }
    );
  }

  const { deliberationId } = query.data;

  try {
    const conflicts = await detectConflicts(deliberationId);
    const history = await getResolutionHistory(deliberationId);

    // Mark newly detected conflicts
    const allPAIds = conflicts.flatMap(c => c.preferences.map(p => p.id));
    if (allPAIds.length > 0) {
      await markConflictDetected(allPAIds);
    }

    return NextResponse.json(
      {
        conflicts,
        total: conflicts.length,
        totalPreferencesAffected: allPAIds.length,
        history,
      },
      NO_STORE
    );
  } catch (error) {
    console.error("Conflict detection error:", error);
    return NextResponse.json(
      { 
        error: "Failed to detect conflicts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, ...NO_STORE }
    );
  }
}
