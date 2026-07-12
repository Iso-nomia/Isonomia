export const dynamic = "force-dynamic";

/**
 * AI Claim Extraction API
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Extracts claims from source text using AI, returning suggestions
 * that users can review and confirm.
 * 
 * @route POST /api/claims/extract
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import {
  extractClaimsFromAbstract,
  extractClaimsFromFullText,
  ExtractedClaim,
} from "@/lib/claims/extraction";
import { z } from "zod";

// ─────────────────────────────────────────────────────────
// Request Schema
// ─────────────────────────────────────────────────────────

const ExtractClaimsSchema = z.object({
  sourceId: z.string(),
  mode: z.enum(["abstract", "fulltext"]).default("abstract"),
  fulltext: z.string().optional(), // Required if mode is "fulltext"
});

// ─────────────────────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const input = ExtractClaimsSchema.parse(body);

    // Get source with abstract
    const source = await prisma.source.findUnique({
      where: { id: input.sourceId },
      select: {
        id: true,
        title: true,
        abstractText: true,
        kind: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found", details: `No source with ID: ${input.sourceId}` },
        { status: 404 }
      );
    }

    let result;

    if (input.mode === "abstract") {
      // Extract from abstract
      if (!source.abstractText) {
        return NextResponse.json(
          { 
            error: "No abstract available", 
            details: "This source does not have an abstract. Try fulltext mode instead." 
          },
          { status: 400 }
        );
      }

      result = await extractClaimsFromAbstract(
        source.abstractText,
        source.title || "Untitled Source"
      );
    } else {
      // Extract from fulltext
      if (!input.fulltext) {
        return NextResponse.json(
          { 
            error: "Fulltext required", 
            details: "You must provide the fulltext when using fulltext mode." 
          },
          { status: 400 }
        );
      }

      result = await extractClaimsFromFullText(
        input.fulltext,
        source.title || "Untitled Source"
      );
    }

    // Return suggestions without saving - user must confirm
    return NextResponse.json({
      success: true,
      sourceId: source.id,
      sourceTitle: source.title,
      mode: input.mode,
      suggestions: result.claims,
      meta: {
        processingTimeMs: result.processingTime,
        tokensUsed: result.tokensUsed,
        claimCount: result.claims.length,
      },
    });
  } catch (error) {
    console.error("[claims/extract] Extraction error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    
    // Handle OpenAI-specific errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "AI service configuration error" },
          { status: 503 }
        );
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "AI service rate limited. Please try again later." },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
