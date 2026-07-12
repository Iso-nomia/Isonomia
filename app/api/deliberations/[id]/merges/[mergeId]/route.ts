export const dynamic = "force-dynamic";

/**
 * API Route: Individual Merge Request
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * GET   /api/deliberations/[id]/merges/[mergeId] - Get merge request details
 * PATCH /api/deliberations/[id]/merges/[mergeId] - Update merge request status
 * POST  /api/deliberations/[id]/merges/[mergeId] - Execute merge (action=execute)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import {
  getMergeRequest,
  updateMergeRequestStatus,
  executeMerge,
  addMergeComment,
} from "@/lib/forks/mergeService";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const MergeStatusEnum = z.enum([
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "MERGED",
  "CLOSED",
  "CONFLICT",
]);

const UpdateMergeRequestSchema = z.object({
  status: MergeStatusEnum,
});

const AddCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

// ─────────────────────────────────────────────────────────
// GET - Get merge request details
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; mergeId: string } }
) {
  try {
    const { mergeId } = params;

    const mergeRequest = await getMergeRequest(mergeId);

    if (!mergeRequest) {
      return NextResponse.json(
        { error: "Merge request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(mergeRequest);
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/merges/[mergeId]] Error:", error);
    return NextResponse.json(
      { error: "Failed to get merge request" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// PATCH - Update merge request status
// ─────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; mergeId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mergeId } = params;

    // 2. Parse body
    const body = await req.json();
    const parsed = UpdateMergeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Update status
    const updatedMergeRequest = await updateMergeRequestStatus(
      mergeId,
      parsed.data.status,
      userId
    );

    return NextResponse.json(updatedMergeRequest);
  } catch (error) {
    console.error("[PATCH /api/deliberations/[id]/merges/[mergeId]] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update merge request" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// POST - Execute merge or add comment
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; mergeId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mergeId } = params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Handle execute action
    if (action === "execute") {
      // executeMerge throws on failure; a successful resolution means the
      // merge completed and returns the counts of merged entities.
      const result = await executeMerge(mergeId, userId);

      return NextResponse.json({
        success: true,
        claimsMerged: result.mergedClaims,
        argumentsMerged: result.mergedArguments,
      });
    }

    // Handle add comment action
    if (action === "comment") {
      const body = await req.json();
      const parsed = AddCommentSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const comment = await addMergeComment(
        mergeId,
        userId,
        parsed.data.content
      );

      return NextResponse.json(comment, { status: 201 });
    }

    return NextResponse.json(
      { error: "Invalid action. Use ?action=execute or ?action=comment" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[POST /api/deliberations/[id]/merges/[mergeId]] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes("not in APPROVED")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}
