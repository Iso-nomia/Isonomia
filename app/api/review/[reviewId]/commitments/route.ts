export const dynamic = "force-dynamic";

/**
 * Reviewer commitment endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { getReviewCommitments } from "@/lib/review/commitmentService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const { searchParams } = new URL(req.url);
    const onlyBlocking = searchParams.get("blocking") === "true";
    const onlyUnresolved = searchParams.get("unresolved") === "true";

    const commitments = await getReviewCommitments(reviewId, {
      onlyBlocking,
      onlyUnresolved,
    });

    return NextResponse.json(commitments);
  } catch (error) {
    console.error("Error fetching commitments:", error);
    return NextResponse.json(
      { error: "Failed to fetch commitments" },
      { status: 500 }
    );
  }
}
