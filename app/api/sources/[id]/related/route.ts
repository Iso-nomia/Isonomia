export const dynamic = "force-dynamic";

/**
 * Phase 3.4.2: Related Sources API
 * 
 * Returns sources related to the given source
 * based on co-occurrence and topic overlap.
 */

import { NextRequest, NextResponse } from "next/server";
import { findRelatedSources } from "@/lib/similarity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, parseInt(searchParams.get("limit") || "10", 10));

    const sources = await findRelatedSources(sourceId, limit);

    return NextResponse.json({ 
      sources,
      count: sources.length,
      sourceId,
    });
  } catch (error) {
    console.error("[Related Sources API] Error:", error);
    return NextResponse.json(
      { error: "Failed to find related sources" },
      { status: 500 }
    );
  }
}
