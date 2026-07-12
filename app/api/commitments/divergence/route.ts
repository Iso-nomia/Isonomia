export const dynamic = "force-dynamic";

/**
 * POST /api/commitments/divergence
 * 
 * Check for semantic divergence between two participants at a locus.
 * Returns conflicts where one asserts and the other denies the same proposition.
 * 
 * Request body:
 * {
 *   dialogueId: string;
 *   ownerA: string; // e.g., "Proponent"
 *   ownerB: string; // e.g., "Opponent"
 *   locusPath?: string; // default "0"
 * }
 * 
 * Response:
 * {
 *   ok: boolean;
 *   divergent: boolean;
 *   conflicts: Array<{
 *     proposition: string;
 *     ownerAPosition: 'asserts' | 'denies';
 *     ownerBPosition: 'asserts' | 'denies';
 *     locusPath: string;
 *   }>;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { checkSemanticDivergence } from "@/packages/ludics-engine/commitments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dialogueId, ownerA, ownerB, locusPath = "0" } = body;

    if (!dialogueId || !ownerA || !ownerB) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: dialogueId, ownerA, ownerB" },
        { status: 400 }
      );
    }

    const result = await checkSemanticDivergence(dialogueId, ownerA, ownerB, locusPath);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[commitments/divergence] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
