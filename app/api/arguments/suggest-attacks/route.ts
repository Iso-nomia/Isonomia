export const dynamic = "force-dynamic";

/**
 * Attack Suggestion API
 * 
 * POST /api/arguments/suggest-attacks
 * Generates strategic attack suggestions for a target argument based on
 * critical question analysis.
 * 
 * Phase 3.1: Backend Services
 */

import { NextRequest, NextResponse } from "next/server";
import { argumentGenerationService } from "@/app/server/services/ArgumentGenerationService";
import { getUserFromCookies } from "@/lib/serverutils";

export async function POST(request: NextRequest) {
  try {
    // 0. Check authentication
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { error: "Unauthorized - please log in" },
        { status: 401 }
      );
    }

    // 1. Parse request body
    const body = await request.json();
    const {
      targetClaimId,
      targetArgumentId,
      userId,
      context,
    } = body;

    if (!targetClaimId) {
      return NextResponse.json(
        { error: "targetClaimId is required" },
        { status: 400 }
      );
    }

    // Use authenticated user's ID if not provided
    const effectiveUserId = userId || String(user.userId);

    // 2. Generate suggestions
    const suggestions = await argumentGenerationService.suggestAttacks({
      targetClaimId,
      targetArgumentId,
      userId: effectiveUserId,
      context,
    });

    // 4. Return suggestions
    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error: any) {
    console.error("Error generating attack suggestions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate attack suggestions" },
      { status: 500 }
    );
  }
}