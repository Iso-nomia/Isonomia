export const dynamic = "force-dynamic";

/**
 * Reviewer assignment endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  inviteReviewer,
  getReviewerAssignments,
} from "@/lib/review/assignmentService";

const InviteReviewerSchema = z.object({
  userId: z.string(),
  role: z
    .enum([
      "REVIEWER",
      "SENIOR_REVIEWER",
      "STATISTICAL_REVIEWER",
      "ETHICS_REVIEWER",
      "GUEST_EDITOR",
    ])
    .default("REVIEWER"),
  deadline: z.string().datetime().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const assignments = await getReviewerAssignments(reviewId);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

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
    const { userId, role, deadline } = InviteReviewerSchema.parse(body);

    const assignment = await inviteReviewer(
      reviewId,
      userId,
      role,
      user.id,
      deadline ? new Date(deadline) : undefined
    );

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error inviting reviewer:", error);
    return NextResponse.json(
      { error: "Failed to invite reviewer" },
      { status: 500 }
    );
  }
}
