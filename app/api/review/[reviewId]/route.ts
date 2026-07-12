export const dynamic = "force-dynamic";

/**
 * Single review endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  getReviewDeliberation,
  updateReviewStatus,
} from "@/lib/review/reviewService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const review = await getReviewDeliberation(reviewId);

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error("Error fetching review:", error);
    return NextResponse.json(
      { error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}

const UpdateStatusSchema = z.object({
  status: z.enum([
    "INITIATED",
    "IN_REVIEW",
    "AUTHOR_RESPONSE",
    "REVISION",
    "FINAL_REVIEW",
    "DECISION",
    "COMPLETED",
    "WITHDRAWN",
  ]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId } = await params;
    const body = await req.json();
    const { status } = UpdateStatusSchema.parse(body);

    const review = await updateReviewStatus(
      reviewId,
      status,
      user.id
    );

    return NextResponse.json(review);
  } catch (error) {
    console.error("Error updating review:", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}
