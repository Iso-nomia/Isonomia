export const dynamic = "force-dynamic";

/**
 * Review decision endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import { makeReviewDecision } from "@/lib/review/reviewService";

const DecisionSchema = z.object({
  decision: z.enum([
    "ACCEPT",
    "MINOR_REVISION",
    "MAJOR_REVISION",
    "REJECT",
    "DESK_REJECT",
  ]),
  note: z.string().min(10),
});

export async function POST(
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
    const { decision, note } = DecisionSchema.parse(body);

    const review = await makeReviewDecision(
      reviewId,
      decision,
      note,
      user.id
    );

    return NextResponse.json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error making decision:", error);
    return NextResponse.json(
      { error: "Failed to make decision" },
      { status: 500 }
    );
  }
}
