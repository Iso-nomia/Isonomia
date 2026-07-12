export const dynamic = "force-dynamic";

/**
 * Template Generation API
 * 
 * POST /api/arguments/generate-template
 * Creates structured argument templates with guidance and prefilled data.
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
      targetId, // For test mode or from ArgumentConstructor
      mode, // attack, support, or general
      attackType,
      targetCQ,
      prefilledData,
    } = body;

    if (!schemeId) {
      return NextResponse.json(
        { error: "schemeId is required" },
        { status: 400 }
      );
    }

    // Resolve the target claim ID
    // Priority: claimId > targetId (both work)
    const resolvedTargetId = claimId || targetId;
    
    console.log("[generate-template] Request:", { 
      schemeId, 
      claimId, 
      targetId, 
      resolvedTargetId,
      mode, 
      attackType 
    });
    
    // Mock templates for testing when service fails or test mode
    const mockTemplates: Record<string, any> = {
      "expert-opinion": {
        schemeId: "expert-opinion",
        schemeName: "Argument from Expert Opinion",
        conclusion: "The claim is credible based on expert testimony",
        premises: [
          {
            key: "p1",
            text: "Source E is an expert in domain D",
            required: true,
            evidenceType: "expert-credentials",
          },
          {
            key: "p2",
            text: "E asserts that A is true",
            required: true,
            evidenceType: "expert-statement",
          },
          {
            key: "p3",
            text: "A is within domain D",
            required: true,
            evidenceType: "domain-relevance",
          },
        ],
        variables: {
          expert: "",
          domain: "",
          assertion: "",
        },
        prefilledPremises: {},
        prefilledVariables: {},
      },
      "cause-to-effect": {
        schemeId: "cause-to-effect",
        schemeName: "Argument from Cause to Effect",
        conclusion: "Effect E will occur",
        premises: [
          {
            key: "p1",
            text: "Cause C generally leads to effect E",
            required: true,
            evidenceType: "causal-link",
          },
          {
            key: "p2",
            text: "Cause C is present in this case",
            required: true,
            evidenceType: "evidence",
          },
          {
            key: "p3",
            text: "No other factors prevent E",
            required: false,
            evidenceType: "counter-evidence",
          },
        ],
        variables: {
          cause: "",
          effect: "",
        },
        prefilledPremises: {},
        prefilledVariables: {},
      },
    };

    // Always try the real service first
    // Only use mocks if explicitly in test mode or if service fails
    const useTestMode = resolvedTargetId?.includes("test") || mode === "test";
    
    if (!useTestMode) {
      try {
        console.log("[generate-template] Calling ArgumentGenerationService.generateTemplate");
        const template = await argumentGenerationService.generateTemplate({
          schemeId,
          claimId: resolvedTargetId, // Can be undefined for general mode
          attackType,
          targetCQ,
          prefilledData,
        });
        console.log("[generate-template] Service returned template:", {
          schemeName: template.schemeName,
          conclusion: template.conclusion?.substring(0, 50),
          premisesCount: template.premises.length
        });
        return NextResponse.json({ template }, { status: 200 });
      } catch (serviceError: any) {
        console.warn("[generate-template] Service failed, using mock template:", serviceError.message);
      }
    }

    // Use mock template (test mode or service failed)
    console.log("[generate-template] Using mock template for scheme:", schemeId);
    const mockTemplate = mockTemplates[schemeId] || {
      schemeId: schemeId,
      schemeName: "General Argument",
      conclusion: "Therefore, the conclusion follows",
      premises: [
        {
          key: "p1",
          text: "First premise",
          required: true,
          evidenceType: "evidence",
        },
        {
          key: "p2",
          text: "Second premise",
          required: true,
          evidenceType: "evidence",
        },
      ],
      variables: {},
      prefilledPremises: {},
      prefilledVariables: {},
    };

    return NextResponse.json({ template: mockTemplate }, { status: 200 });
  } catch (error: any) {
    console.error("Error generating template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate template" },
      { status: 500 }
    );
  }
}
