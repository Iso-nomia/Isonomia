export const dynamic = "force-dynamic";

/**
 * Phase 3.4.2: Related Deliberations API
 * 
 * Returns deliberations related to the given deliberation
 * based on shared sources and topic overlap.
 */

import { NextRequest, NextResponse } from "next/server";
import { findRelatedDeliberations } from "@/lib/similarity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deliberationId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, parseInt(searchParams.get("limit") || "10", 10));

    const deliberations = await findRelatedDeliberations(deliberationId, limit);

    return NextResponse.json({ 
      deliberations,
      count: deliberations.length,
      deliberationId,
    });
  } catch (error) {
    console.error("[Related Deliberations API] Error:", error);
    return NextResponse.json(
      { error: "Failed to find related deliberations" },
      { status: 500 }
    );
  }
}
