export const dynamic = "force-dynamic";

/**
 * Support Suggestion API
 * 
 * POST /api/arguments/suggest-support
 * Generates support argument suggestions by matching evidence to schemes.
 * 
 * Phase 3.1: Backend Services
 */

import { NextRequest, NextResponse } from "next/server";
import { argumentGenerationService } from "@/app/server/services/ArgumentGenerationService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      claimId,
      userId,
      availableEvidence,
      context,
    } = body;

    if (!claimId) {
      return NextResponse.json(
        { error: "claimId is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const suggestions = await argumentGenerationService.suggestSupport({
      claimId,
      userId,
      availableEvidence: availableEvidence || [],
      context,
    });

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error: any) {
    console.error("Error generating support suggestions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate support suggestions" },
      { status: 500 }
    );
  }
}
