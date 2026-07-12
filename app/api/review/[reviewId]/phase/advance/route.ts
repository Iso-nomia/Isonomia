export const dynamic = "force-dynamic";

/**
 * Advance review phase endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { advanceToNextPhase } from "@/lib/review/reviewService";
import { canAdvancePhase } from "@/lib/review/progressService";

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

    // Check if can advance
    const { canAdvance, blockers } = await canAdvancePhase(reviewId);

    if (!canAdvance) {
      return NextResponse.json(
        { error: "Cannot advance phase", blockers },
        { status: 400 }
      );
    }

    const nextPhase = await advanceToNextPhase(
      reviewId,
      user.id
    );

    return NextResponse.json(nextPhase);
  } catch (error) {
    console.error("Error advancing phase:", error);
    return NextResponse.json(
      { error: "Failed to advance phase" },
      { status: 500 }
    );
  }
}
