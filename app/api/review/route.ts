export const dynamic = "force-dynamic";

/**
 * Review deliberation API endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  createReviewDeliberation,
  listUserReviews,
} from "@/lib/review/reviewService";
import type { ReviewStatus } from "@/lib/review/types";

const CreateReviewSchema = z.object({
  targetType: z.enum([
    "PAPER",
    "PREPRINT",
    "THESIS",
    "GRANT_PROPOSAL",
    "OTHER",
  ]),
  targetSourceId: z.string().optional(),
  targetUrl: z.string().url().optional(),
  targetTitle: z.string().min(1).max(500),
  templateId: z.string().optional(),
  isBlinded: z.boolean().default(false),
  isPublicReview: z.boolean().default(true),
  initialReviewers: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = CreateReviewSchema.parse(body);

    const review = await createReviewDeliberation(input, user.id);

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") as "editor" | "reviewer" | "author" | undefined;
    const statusParam = searchParams.get("status");
    const status = statusParam ? (statusParam as ReviewStatus) : undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    const reviews = await listUserReviews(user.id, {
      role,
      status,
      limit,
      offset,
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Error listing reviews:", error);
    return NextResponse.json(
      { error: "Failed to list reviews" },
      { status: 500 }
    );
  }
}
