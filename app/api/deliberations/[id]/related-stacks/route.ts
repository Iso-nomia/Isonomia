export const dynamic = "force-dynamic";

/**
 * Phase 3.4.2: Related Stacks API
 * 
 * Returns stacks related to the given deliberation
 * based on shared sources.
 */

import { NextRequest, NextResponse } from "next/server";
import { findRelatedStacks } from "@/lib/similarity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deliberationId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, parseInt(searchParams.get("limit") || "10", 10));

    const stacks = await findRelatedStacks(deliberationId, limit);

    return NextResponse.json({ 
      stacks,
      count: stacks.length,
      deliberationId,
    });
  } catch (error) {
    console.error("[Related Stacks API] Error:", error);
    return NextResponse.json(
      { error: "Failed to find related stacks" },
      { status: 500 }
    );
  }
}
