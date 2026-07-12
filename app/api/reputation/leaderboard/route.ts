export const dynamic = "force-dynamic";

/**
 * Reputation leaderboard endpoint
 * Phase 4.2: Argumentation-Based Reputation
 */

import { NextRequest, NextResponse } from "next/server";
import { getReputationLeaderboard } from "@/lib/reputation/statsService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const minContributions = searchParams.get("minContributions")
      ? parseInt(searchParams.get("minContributions")!)
      : undefined;

    const leaderboard = await getReputationLeaderboard({
      limit,
      minContributions,
    });

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
