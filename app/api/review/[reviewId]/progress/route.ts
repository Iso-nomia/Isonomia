export const dynamic = "force-dynamic";

/**
 * Review progress endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getReviewProgress,
  canAdvancePhase,
  getReviewStats,
  checkReviewHealth,
} from "@/lib/review/progressService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const { searchParams } = new URL(req.url);
    const includeStats = searchParams.get("stats") === "true";
    const includeHealth = searchParams.get("health") === "true";

    const [progress, advanceStatus] = await Promise.all([
      getReviewProgress(reviewId),
      canAdvancePhase(reviewId),
    ]);

    const response: any = {
      ...progress,
      canAdvance: advanceStatus.canAdvance,
      blockers: advanceStatus.blockers,
    };

    if (includeStats) {
      response.stats = await getReviewStats(reviewId);
    }

    if (includeHealth) {
      response.health = await checkReviewHealth(reviewId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
