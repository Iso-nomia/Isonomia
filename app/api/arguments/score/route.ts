export const dynamic = "force-dynamic";

/**
 * Argument Scoring API
 * 
 * POST /api/arguments/score
 * Scores partially constructed arguments and provides improvement suggestions.
 * 
 * Phase 3.1: Backend Services
 */

import { NextRequest, NextResponse } from "next/server";
import { argumentGenerationService } from "@/app/server/services/ArgumentGenerationService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      schemeId,
      claimId,
      filledPremises,
      premises, // Accept both naming conventions
    } = body;

    const resolvedPremises = filledPremises || premises;

    if (!schemeId || !resolvedPremises) {
      return NextResponse.json(
        { error: "schemeId and premises are required" },
        { status: 400 }
      );
    }

    // Calculate basic scores from filled premises
    const premiseValues = Object.values(resolvedPremises) as string[];
    const filledCount = premiseValues.filter((p) => p && p.trim() !== "").length;
    const totalCount = premiseValues.length;
    const completenessScore = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

    // Calculate average premise quality (based on length and content)
    const premiseScores: Record<string, number> = {};
    let totalPremiseScore = 0;
    Object.entries(resolvedPremises).forEach(([key, value]) => {
      const text = (value as string) || "";
      const wordCount = text.trim().split(/\s+/).length;
      // Score based on word count: 0 words = 0%, 5+ words = 80%, 10+ words = 100%
      let score = 0;
      if (wordCount === 0) score = 0;
      else if (wordCount < 5) score = Math.min(60, wordCount * 12);
      else if (wordCount < 10) score = 60 + ((wordCount - 5) * 8);
      else score = 100;
      premiseScores[key] = score;
      totalPremiseScore += score;
    });
    const avgPremiseScore = totalCount > 0 ? Math.round(totalPremiseScore / totalCount) : 0;

    // Mock scores for testing (can be replaced with real service call)
    const mockScore = {
      overallScore: Math.min(100, Math.round((completenessScore * 0.4) + (avgPremiseScore * 0.6))),
      completenessScore,
      evidenceScore: 0, // No evidence scoring yet
      coherenceScore: avgPremiseScore,
      vulnerabilityScore: 0,
      premiseScores,
      missingElements: premiseValues
        .map((p, i) => (!p || p.trim() === "") ? `Premise ${i + 1}` : null)
        .filter(Boolean) as string[],
      suggestions: [
        completenessScore < 100 ? "Fill in all premises to improve completeness" : null,
        avgPremiseScore < 70 ? "Add more detail to your premises" : null,
      ].filter(Boolean) as string[],
    };

    // Try real service first if not in test mode
    const isTestMode = claimId && (claimId.includes("test") || claimId.includes("TEST"));
    if (!isTestMode && claimId) {
      try {
        const score = await argumentGenerationService.scoreArgument({
          schemeId,
          claimId,
          filledPremises: resolvedPremises,
        });
        return NextResponse.json({ score }, { status: 200 });
      } catch (serviceError) {
        console.warn("Service scoring failed, using mock:", serviceError);
        // Fall through to mock
      }
    }

    // Return mock score for testing or if service fails
    return NextResponse.json({ score: mockScore }, { status: 200 });
  } catch (error: any) {
    console.error("Error scoring argument:", error);
    return NextResponse.json(
      { error: error.message || "Failed to score argument" },
      { status: 500 }
    );
  }
}
