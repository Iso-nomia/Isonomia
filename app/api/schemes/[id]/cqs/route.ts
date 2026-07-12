export const dynamic = "force-dynamic";

// app/api/schemes/[id]/cqs/route.ts
/**
 * GET /api/schemes/:id/cqs
 * 
 * Fetch critical questions for a scheme with optional inheritance
 * Phase 6B: Supports hierarchical CQ inheritance from parent schemes
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCompleteCQSetWithInheritance } from "@/lib/argumentation/cqInheritance";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: schemeId } = params;
    const { searchParams } = new URL(request.url);

    // Query params
    const includeInherited = searchParams.get("includeInherited") !== "false";
    const maxCQs = parseInt(searchParams.get("maxCQs") || "15", 10);

    if (!schemeId) {
      return NextResponse.json(
        { error: "Scheme ID required" },
        { status: 400 }
      );
    }

    const cqs = await generateCompleteCQSetWithInheritance(
      schemeId,
      includeInherited,
      maxCQs
    );

    const ownCQs = cqs.filter((cq) => !cq.inherited);
    const inheritedCQs = cqs.filter((cq) => cq.inherited);

    return NextResponse.json(
      {
        cqs,
        summary: {
          total: cqs.length,
          own: ownCQs.length,
          inherited: inheritedCQs.length,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[GET /api/schemes/:id/cqs]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch CQs",
      },
      { status: 500 }
    );
  }
}
