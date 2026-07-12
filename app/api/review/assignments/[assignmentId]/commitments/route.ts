export const dynamic = "force-dynamic";

/**
 * Create commitment for an assignment
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  createCommitment,
  getAssignmentCommitments,
} from "@/lib/review/commitmentService";

const CommitmentSchema = z.object({
  topic: z.string().min(1).max(200),
  description: z.string().min(10),
  position: z.enum([
    "STRONGLY_SUPPORT",
    "SUPPORT",
    "NEUTRAL",
    "CONCERN",
    "STRONGLY_OPPOSE",
  ]),
  strength: z.enum(["WEAK", "MODERATE", "STRONG", "BLOCKING"]),
  argumentId: z.string().optional(),
  targetClaimId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params;
    const commitments = await getAssignmentCommitments(assignmentId);
    return NextResponse.json(commitments);
  } catch (error) {
    console.error("Error fetching commitments:", error);
    return NextResponse.json(
      { error: "Failed to fetch commitments" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assignmentId } = await params;
    const body = await req.json();
    const input = CommitmentSchema.parse(body);

    const commitment = await createCommitment(
      assignmentId,
      input,
      user.id
    );

    return NextResponse.json(commitment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating commitment:", error);
    return NextResponse.json(
      { error: "Failed to create commitment" },
      { status: 500 }
    );
  }
}
