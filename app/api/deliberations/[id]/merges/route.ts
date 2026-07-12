export const dynamic = "force-dynamic";

/**
 * API Route: Merge Requests
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * POST /api/deliberations/[id]/merges - Create a merge request
 * GET  /api/deliberations/[id]/merges - List merge requests (incoming)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import {
  createMergeRequest,
  listMergeRequests,
  analyzeMerge,
} from "@/lib/forks/mergeService";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const MergeStrategyEnum = z.enum([
  "ADD_NEW",
  "REPLACE",
  "LINK_SUPPORT",
  "LINK_CHALLENGE",
  "SKIP",
]);

const ClaimSelectionSchema = z.object({
  claimId: z.string(),
  strategy: MergeStrategyEnum,
  targetClaimId: z.string().optional(),
});

const ArgumentSelectionSchema = z.object({
  argumentId: z.string(),
  includeWithClaims: z.boolean().default(false),
});

const CreateMergeRequestSchema = z.object({
  sourceDeliberationId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  claimsToMerge: z.array(ClaimSelectionSchema),
  argumentsToMerge: z.array(ArgumentSelectionSchema).default([]),
});

const AnalyzeMergeSchema = z.object({
  sourceDeliberationId: z.string(),
  claimsToMerge: z.array(ClaimSelectionSchema),
  argumentsToMerge: z.array(ArgumentSelectionSchema).default([]),
});

// ─────────────────────────────────────────────────────────
// POST - Create a merge request
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetDeliberationId = params.id;
    const url = new URL(req.url);
    const isAnalyzeOnly = url.searchParams.get("analyze") === "true";

    // 2. Parse body
    const body = await req.json();

    if (isAnalyzeOnly) {
      // Just analyze, don't create
      const parsed = AnalyzeMergeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const analysis = await analyzeMerge(
        parsed.data.sourceDeliberationId,
        targetDeliberationId,
        parsed.data.claimsToMerge,
        parsed.data.argumentsToMerge
      );

      return NextResponse.json({ analysis });
    }

    // 3. Create merge request
    const parsed = CreateMergeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const mergeRequest = await createMergeRequest(
      {
        ...parsed.data,
        targetDeliberationId,
      },
      (session!.user as any).id
    );

    return NextResponse.json(mergeRequest, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deliberations/[id]/merges] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create merge request" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// GET - List merge requests
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as
      | "OPEN"
      | "IN_REVIEW"
      | "APPROVED"
      | "MERGED"
      | "CLOSED"
      | "CONFLICT"
      | null;
    const asSource = url.searchParams.get("direction") === "outgoing";

    const mergeRequests = await listMergeRequests(deliberationId, {
      status: status || undefined,
      asSource,
    });

    return NextResponse.json({
      mergeRequests,
      total: mergeRequests.length,
    });
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/merges] Error:", error);
    return NextResponse.json(
      { error: "Failed to list merge requests" },
      { status: 500 }
    );
  }
}
