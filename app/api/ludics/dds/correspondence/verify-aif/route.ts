export const dynamic = "force-dynamic";

/**
 * AIF Correspondence Verification API
 * 
 * POST: Verify Disp(D) ↔ Ch(S) correspondence at AIF level
 * 
 * Based on Faggian & Hyland (2002) Proposition 4.27-4.28:
 * - Disp(Ch(S)) = S
 * - Ch(Disp(D)) = D
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAifCorrespondence,
  isCorrespondenceValid,
  getCorrespondenceIssues,
  repairCorrespondence,
} from "@/lib/ludics/aifCorrespondence";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deliberationId, action = "verify" } = body;

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "verify": {
        // Full verification
        const result = await verifyAifCorrespondence(deliberationId);
        return NextResponse.json({
          ok: true,
          ...result,
        });
      }

      case "quick-check": {
        // Quick validity check
        const isValid = await isCorrespondenceValid(deliberationId);
        return NextResponse.json({
          ok: true,
          deliberationId,
          valid: isValid,
        });
      }

      case "issues": {
        // Get issues summary
        const issuesSummary = await getCorrespondenceIssues(deliberationId);
        return NextResponse.json({
          ok: true,
          deliberationId,
          ...issuesSummary,
        });
      }

      case "repair": {
        // Repair correspondence by re-syncing
        const repairResult = await repairCorrespondence(deliberationId);
        return NextResponse.json({
          ok: true,
          deliberationId,
          ...repairResult,
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}. Use verify, quick-check, issues, or repair.` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[verify-aif] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deliberationId = searchParams.get("deliberationId");

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId query parameter is required" },
        { status: 400 }
      );
    }

    // Default to quick-check for GET requests
    const isValid = await isCorrespondenceValid(deliberationId);
    
    return NextResponse.json({
      ok: true,
      deliberationId,
      valid: isValid,
    });
  } catch (error) {
    console.error("[verify-aif] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
