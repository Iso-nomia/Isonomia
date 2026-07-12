export const dynamic = "force-dynamic";

/**
 * Author response endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  createAuthorResponse,
  getAuthorResponses,
  getResponseSummary,
} from "@/lib/review/authorResponseService";

const MoveSchema = z.object({
  targetCommitmentId: z.string().optional(),
  targetArgumentId: z.string().optional(),
  moveType: z.enum([
    "CONCEDE",
    "DEFEND",
    "QUALIFY",
    "REVISE",
    "DEFER",
    "CLARIFY",
    "CHALLENGE",
  ]),
  explanation: z.string().min(10),
  supportingArgumentId: z.string().optional(),
  revisionDescription: z.string().optional(),
  revisionLocation: z.string().optional(),
});

const CreateResponseSchema = z.object({
  phaseId: z.string(),
  summary: z.string().min(20),
  moves: z.array(MoveSchema).min(1),
  revisionId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const { searchParams } = new URL(req.url);
    const summary = searchParams.get("summary") === "true";

    if (summary) {
      const responseSummary = await getResponseSummary(reviewId);
      return NextResponse.json(responseSummary);
    }

    const responses = await getAuthorResponses(reviewId);
    return NextResponse.json(responses);
  } catch (error) {
    console.error("Error fetching responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch responses" },
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
    const input = CreateResponseSchema.parse(body);

    const response = await createAuthorResponse(
      {
        reviewId,
        ...input,
      },
      user.id
    );

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating response:", error);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}
