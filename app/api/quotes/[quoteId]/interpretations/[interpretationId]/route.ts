export const dynamic = "force-dynamic";

/**
 * API Route: Interpretation Detail
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * GET    /api/quotes/[quoteId]/interpretations/[interpretationId] - Get interpretation
 * PATCH  /api/quotes/[quoteId]/interpretations/[interpretationId] - Update interpretation
 * DELETE /api/quotes/[quoteId]/interpretations/[interpretationId] - Delete interpretation
 * POST   /api/quotes/[quoteId]/interpretations/[interpretationId]?action=vote - Vote on interpretation
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import {
  getInterpretation,
  updateInterpretation,
  deleteInterpretation,
  voteOnInterpretation,
} from "@/lib/quotes";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const UpdateInterpretationSchema = z.object({
  interpretation: z.string().min(1).max(20000).optional(),
  framework: z.string().max(100).optional(),
  methodology: z.string().max(500).optional(),
});

const VoteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

// ─────────────────────────────────────────────────────────
// GET - Get interpretation details
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { quoteId: string; interpretationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    const interpretation = await getInterpretation(
      params.interpretationId,
      userId
    );

    if (!interpretation) {
      return NextResponse.json(
        { error: "Interpretation not found" },
        { status: 404 }
      );
    }

    // Note: The service returns interpretation for the given ID
    // We trust the quoteId association is correct at the service level

    return NextResponse.json(interpretation);
  } catch (error) {
    console.error(
      "[GET /api/quotes/[quoteId]/interpretations/[interpretationId]] Error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to get interpretation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// PATCH - Update interpretation
// ─────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { quoteId: string; interpretationId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const parsed = UpdateInterpretationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Verify interpretation exists and belongs to user
    const existing = await getInterpretation(params.interpretationId);
    if (!existing) {
      return NextResponse.json(
        { error: "Interpretation not found" },
        { status: 404 }
      );
    }
    if (existing.author.id !== userId) {
      return NextResponse.json(
        { error: "Can only edit your own interpretations" },
        { status: 403 }
      );
    }

    // 4. Update interpretation
    const interpretation = await updateInterpretation(
      params.interpretationId,
      userId,
      parsed.data
    );

    return NextResponse.json(interpretation);
  } catch (error) {
    console.error(
      "[PATCH /api/quotes/[quoteId]/interpretations/[interpretationId]] Error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to update interpretation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// DELETE - Delete interpretation
// ─────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { quoteId: string; interpretationId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify interpretation exists and belongs to user
    const existing = await getInterpretation(params.interpretationId);
    if (!existing) {
      return NextResponse.json(
        { error: "Interpretation not found" },
        { status: 404 }
      );
    }
    if (existing.author.id !== userId) {
      return NextResponse.json(
        { error: "Can only delete your own interpretations" },
        { status: 403 }
      );
    }

    // 3. Delete interpretation
    await deleteInterpretation(params.interpretationId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[DELETE /api/quotes/[quoteId]/interpretations/[interpretationId]] Error:",
      error
    );

    if (
      error instanceof Error &&
      error.message.includes("other interpretations")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Failed to delete interpretation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// POST - Vote on interpretation
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { quoteId: string; interpretationId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check action
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action !== "vote") {
      return NextResponse.json(
        { error: "Invalid action. Use ?action=vote" },
        { status: 400 }
      );
    }

    // 3. Parse vote
    const body = await req.json();
    const parsed = VoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid vote value. Must be 1 or -1." },
        { status: 400 }
      );
    }

    // 4. Vote
    const result = await voteOnInterpretation(
      params.interpretationId,
      userId,
      parsed.data.value
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[POST /api/quotes/[quoteId]/interpretations/[interpretationId]] Error:",
      error
    );

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
  }
}
