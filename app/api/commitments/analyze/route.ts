export const dynamic = "force-dynamic";

/**
 * GET /api/commitments/analyze
 * 
 * Analyze inference across all loci in a dialogue for both participants.
 * Returns per-locus stats and semantic divergence points.
 * 
 * Query params:
 *   dialogueId: string;
 *   ownerA?: string; // default "Proponent"
 *   ownerB?: string; // default "Opponent"
 * 
 * Response:
 * {
 *   ok: boolean;
 *   lociAnalysis: Array<{
 *     locusPath: string;
 *     ownerA: { factCount, ruleCount, derivedCount, contradictions };
 *     ownerB: { factCount, ruleCount, derivedCount, contradictions };
 *     semanticDivergence: boolean;
 *     conflicts: Array<{ proposition, ownerAPosition, ownerBPosition }>;
 *   }>;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeDialogueInference } from "@/packages/ludics-engine/commitments";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dialogueId = searchParams.get("dialogueId");
    const ownerA = searchParams.get("ownerA") || "Proponent";
    const ownerB = searchParams.get("ownerB") || "Opponent";

    if (!dialogueId) {
      return NextResponse.json(
        { ok: false, error: "Missing required param: dialogueId" },
        { status: 400 }
      );
    }

    const result = await analyzeDialogueInference(dialogueId, ownerA, ownerB);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[commitments/analyze] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
