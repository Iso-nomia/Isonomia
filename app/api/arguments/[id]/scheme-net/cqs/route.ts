export const dynamic = "force-dynamic";

// app/api/arguments/[id]/scheme-net/cqs/route.ts
/**
 * GET /api/arguments/:id/scheme-net/cqs
 * 
 * Returns Critical Questions grouped by scheme net step
 * Phase 5C: UI support for scheme net visualization
 */

import { NextRequest, NextResponse } from "next/server";
import { getCQsForSchemeNet } from "@/lib/argumentation/schemeNetLogic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: argumentId } = params;

    if (!argumentId) {
      return NextResponse.json(
        { error: "Argument ID required" },
        { status: 400 }
      );
    }

    const steps = await getCQsForSchemeNet(argumentId);

    return NextResponse.json({ steps }, { status: 200 });
  } catch (error: unknown) {
    console.error("[GET /api/arguments/:id/scheme-net/cqs]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch CQs",
      },
      { status: 500 }
    );
  }
}
