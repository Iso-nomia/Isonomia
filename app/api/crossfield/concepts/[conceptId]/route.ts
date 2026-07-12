export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Single concept API
 * GET — get concept with all equivalences
 */

import { NextRequest, NextResponse } from "next/server";
import { getConceptWithEquivalences } from "@/lib/crossfield/conceptService";

type RouteContext = { params: Promise<{ conceptId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { conceptId } = await context.params;
    const concept = await getConceptWithEquivalences(conceptId);

    if (!concept) {
      return NextResponse.json(
        { error: "Concept not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(concept);
  } catch (error) {
    console.error("Error fetching concept:", error);
    return NextResponse.json(
      { error: "Failed to fetch concept" },
      { status: 500 }
    );
  }
}
