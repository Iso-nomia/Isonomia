export const dynamic = "force-dynamic";

/**
 * Review timeline endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getReviewTimeline, getPhaseDurations } from "@/lib/review/progressService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const { searchParams } = new URL(req.url);
    const includeDurations = searchParams.get("durations") === "true";

    const timeline = await getReviewTimeline(reviewId);

    if (includeDurations) {
      const durations = await getPhaseDurations(reviewId);
      return NextResponse.json({ events: timeline, phaseDurations: durations });
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
