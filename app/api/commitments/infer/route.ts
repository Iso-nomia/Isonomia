export const dynamic = "force-dynamic";

/**
 * POST /api/commitments/infer
 * 
 * Run scoped inference at a specific locus.
 * Inherits facts/rules from parent loci and detects contradictions.
 * 
 * Request body:
 * {
 *   dialogueId: string;
 *   ownerId: string;
 *   locusPath?: string; // default "0"
 * }
 * 
 * Response:
 * {
 *   ok: boolean;
 *   locusPath: string;
 *   derivedFacts: Array<{ label: string; derivedAt: string }>;
 *   contradictions: Array<{ a: string; b: string; aLocusPath: string; bLocusPath: string; type: 'local' | 'inherited' }>;
 *   effectiveFacts: Array<{ label: string; locusPath: string; inherited: boolean }>;
 *   effectiveRules: Array<{ label: string; locusPath: string; inherited: boolean }>;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { interactCEScoped } from "@/packages/ludics-engine/commitments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dialogueId, ownerId, locusPath = "0" } = body;

    if (!dialogueId || !ownerId) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: dialogueId and ownerId" },
        { status: 400 }
      );
    }

    const result = await interactCEScoped(dialogueId, ownerId, locusPath);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[commitments/infer] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
