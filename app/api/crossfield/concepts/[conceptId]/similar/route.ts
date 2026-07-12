export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Find similar concepts across fields
 * GET — returns concepts from other fields with high embedding similarity
 */

import { NextRequest, NextResponse } from "next/server";
import { findSimilarConcepts } from "@/lib/crossfield/conceptService";

type RouteContext = { params: Promise<{ conceptId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { conceptId } = await context.params;
    const { searchParams } = new URL(req.url);
    const minSimilarity = parseFloat(
      searchParams.get("minSimilarity") || "0.7"
    );

    const similar = await findSimilarConcepts(conceptId, minSimilarity);

    return NextResponse.json(similar);
  } catch (error) {
    console.error("Error finding similar concepts:", error);
    return NextResponse.json(
      { error: "Failed to find similar concepts" },
      { status: 500 }
    );
  }
}
