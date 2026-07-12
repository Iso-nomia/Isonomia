export const dynamic = "force-dynamic";

/**
 * API Route: Quotes Collection
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * POST /api/quotes - Create a new quote
 * GET  /api/quotes - Search/list quotes
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import { createQuote, searchQuotes } from "@/lib/quotes";

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

const CreateQuoteSchema = z.object({
  sourceId: z.string().min(1),
  text: z.string().min(1).max(10000),
  locator: z.string().max(100).optional(),
  locatorType: LocatorTypeEnum.optional(),
  context: z.string().max(5000).optional(),
  language: z.string().max(10).optional(),
  isTranslation: z.boolean().optional(),
  originalQuoteId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────
// POST - Create a new quote
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const parsed = CreateQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Create quote
    const quote = await createQuote(parsed.data, userId);

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("[POST /api/quotes] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// GET - Search/list quotes
// ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Parse query params
    const sourceId = url.searchParams.get("sourceId") || undefined;
    const authorId = url.searchParams.get("authorId") || undefined;
    const framework = url.searchParams.get("framework") || undefined;
    const language = url.searchParams.get("language") || undefined;
    const searchText = url.searchParams.get("q") || undefined;
    const deliberationId = url.searchParams.get("deliberationId") || undefined;
    const hasInterpretationsParam = url.searchParams.get("hasInterpretations");
    const hasInterpretations =
      hasInterpretationsParam === "true"
        ? true
        : hasInterpretationsParam === "false"
        ? false
        : undefined;

    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20", 10),
      100
    );
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Search quotes
    const result = await searchQuotes(
      {
        sourceId,
        authorId,
        framework,
        language,
        searchText,
        deliberationId,
        hasInterpretations,
      },
      limit,
      offset
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/quotes] Error:", error);
    return NextResponse.json(
      { error: "Failed to search quotes" },
      { status: 500 }
    );
  }
}
