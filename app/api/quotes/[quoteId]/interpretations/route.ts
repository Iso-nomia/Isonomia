export const dynamic = "force-dynamic";

/**
 * API Route: Interpretations Collection
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * POST /api/quotes/[quoteId]/interpretations - Create new interpretation
 * GET  /api/quotes/[quoteId]/interpretations - List interpretations for quote
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import { createInterpretation, getInterpretations } from "@/lib/quotes";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const CreateInterpretationSchema = z.object({
  interpretation: z.string().min(1).max(20000),
  framework: z.string().max(100).optional(),
  methodology: z.string().max(500).optional(),
  supportsId: z.string().optional(),
  challengesId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────
// POST - Create new interpretation
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const parsed = CreateInterpretationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Create interpretation
    const interpretation = await createInterpretation(
      {
        quoteId: params.quoteId,
        interpretation: parsed.data.interpretation,
        framework: parsed.data.framework,
        methodology: parsed.data.methodology,
        supportsId: parsed.data.supportsId,
        challengesId: parsed.data.challengesId,
      },
      sessionUserId
    );

    return NextResponse.json(interpretation, { status: 201 });
  } catch (error) {
    console.error("[POST /api/quotes/[quoteId]/interpretations] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create interpretation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// GET - List interpretations for quote
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // Get user ID for vote info
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    // Parse query params
    const url = new URL(req.url);
    const framework = url.searchParams.get("framework") || undefined;
    const sortBy = url.searchParams.get("sortBy") as
      | "recent"
      | "score"
      | undefined;

    const interpretations = await getInterpretations(
      params.quoteId,
      userId
    );

    // Filter by framework client-side if needed (or add to service)
    const filtered = framework
      ? interpretations.filter((i) => i.framework === framework)
      : interpretations;

    // Sort
    const sorted = sortBy === "recent"
      ? filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : filtered; // Already sorted by score from service

    return NextResponse.json({
      interpretations: sorted,
      count: sorted.length,
    });
  } catch (error) {
    console.error("[GET /api/quotes/[quoteId]/interpretations] Error:", error);
    return NextResponse.json(
      { error: "Failed to get interpretations" },
      { status: 500 }
    );
  }
}
