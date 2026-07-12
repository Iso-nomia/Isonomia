export const dynamic = "force-dynamic";

/**
 * API Route: Quote Detail
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * GET    /api/quotes/[quoteId] - Get quote with full details
 * PATCH  /api/quotes/[quoteId] - Update quote metadata
 * DELETE /api/quotes/[quoteId] - Delete quote (if unused)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import {
  getQuote,
  updateQuote,
  deleteQuote,
  createQuoteDeliberation,
} from "@/lib/quotes";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const LocatorTypeEnum = z.enum([
  "PAGE",
  "SECTION",
  "CHAPTER",
  "VERSE",
  "TIMESTAMP",
  "LINE",
  "PARAGRAPH",
  "CUSTOM",
]);

const UpdateQuoteSchema = z.object({
  text: z.string().min(1).max(10000).optional(),
  locator: z.string().max(100).optional(),
  locatorType: LocatorTypeEnum.optional(),
  context: z.string().max(5000).optional(),
  language: z.string().max(10).optional(),
});

// ─────────────────────────────────────────────────────────
// GET - Get quote with full details
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // Get user ID for personalized vote info
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    const quote = await getQuote(params.quoteId, userId);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("[GET /api/quotes/[quoteId]] Error:", error);
    return NextResponse.json(
      { error: "Failed to get quote" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// PATCH - Update quote metadata
// ─────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!(session?.user as { id?: string } | undefined)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const parsed = UpdateQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Update quote
    const quote = await updateQuote(params.quoteId, parsed.data);

    return NextResponse.json(quote);
  } catch (error) {
    console.error("[PATCH /api/quotes/[quoteId]] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// DELETE - Delete quote (only if unused)
// ─────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!(session?.user as { id?: string } | undefined)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Delete quote
    await deleteQuote(params.quoteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/quotes/[quoteId]] Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("in use")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// POST - Create discussion deliberation for quote
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!(session?.user as { id?: string } | undefined)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "create-deliberation") {
      const deliberation = await createQuoteDeliberation(
        params.quoteId,
        (session!.user as { id: string }).id
      );
      return NextResponse.json(deliberation, { status: 201 });
    }

    return NextResponse.json(
      { error: "Invalid action. Use ?action=create-deliberation" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[POST /api/quotes/[quoteId]] Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("already has")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
