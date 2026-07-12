// app/api/users/[id]/prediction-stats/route.ts
// GET - Get prediction statistics for a user

import { NextRequest, NextResponse } from "next/server";
import { predictionService } from "@/lib/claims/prediction-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[id]/prediction-stats
 * Get prediction accuracy statistics for a user
 * 
 * Returns:
 * - totalPredictions: Total number of predictions made
 * - pendingCount: Predictions still awaiting resolution
 * - resolvedCount: Total resolved predictions
 * - confirmedCount: Predictions that came true
 * - disconfirmedCount: Predictions that were wrong
 * - partiallyTrueCount: Partially accurate predictions
 * - indeterminateCount: Predictions that couldn't be determined
 * - withdrawnCount: Retracted predictions
 * - expiredCount: Predictions that expired without resolution
 * - accuracyRate: confirmed / (confirmed + disconfirmed) 
 * - averageConfidence: Average confidence level of all predictions
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = decodeURIComponent(params.id || "");
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const stats = await predictionService.getUserStats(userId);

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching user prediction stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch prediction stats" },
      { status: 500 }
    );
  }
}
