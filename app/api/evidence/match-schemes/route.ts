export const dynamic = "force-dynamic";

/**
 * Evidence-to-Scheme Matching API
 * 
 * POST /api/evidence/match-schemes
 * Matches available evidence to optimal argument schemes
 * 
 * Phase 3.4: Support Generator
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evidence, targetArgumentId } = body;

    if (!evidence || !Array.isArray(evidence)) {
      return NextResponse.json(
        { error: "Evidence array is required" },
        { status: 400 }
      );
    }

    // Mock matching for testing (replace with real service in production)
    const isTestMode = true; // Always use test mode for now

    if (isTestMode) {
      // Calculate aggregate evidence metrics
      const avgQuality = evidence.reduce((sum: number, e: any) => sum + (e.quality || 50), 0) / evidence.length;
      const avgCredibility = evidence.reduce((sum: number, e: any) => sum + (e.credibility || 50), 0) / evidence.length;
      const avgRelevance = evidence.reduce((sum: number, e: any) => sum + (e.relevance || 50), 0) / evidence.length;

      // Group evidence by type
      const evidenceByType = evidence.reduce((acc: any, e: any) => {
        acc[e.type] = acc[e.type] || [];
        acc[e.type].push(e);
        return acc;
      }, {});

      // Generate mock matches based on evidence characteristics
      const mockMatches = [];

      // Expert Opinion scheme - if we have expert evidence
      if (evidenceByType["expert-opinion"] || evidenceByType["expert-credentials"]) {
        const expertEvidence = [...(evidenceByType["expert-opinion"] || []), ...(evidenceByType["expert-credentials"] || [])];
        const matchScore = Math.min(95, 60 + (expertEvidence.length * 10) + (avgQuality * 0.25));
        
        mockMatches.push({
          schemeId: "expert-opinion",
          schemeName: "Argument from Expert Opinion",
          schemeCategory: "Source-based",
          matchScore: Math.round(matchScore),
          confidence: Math.round(Math.min(95, avgCredibility * 0.8 + 20)),
          reasoning: `Strong match: ${expertEvidence.length} expert-related evidence items with ${Math.round(avgCredibility)}% average credibility.`,
          evidenceUtilization: {
            usedEvidence: expertEvidence.map((e: any) => e.id),
            unusedEvidence: evidence.filter((e: any) => !expertEvidence.includes(e)).map((e: any) => e.id),
            utilizationRate: Math.round((expertEvidence.length / evidence.length) * 100),
          },
          premiseMapping: [
            {
              premiseKey: "p1",
              premiseTemplate: "Source E is an expert in domain D",
              mappedEvidence: expertEvidence.slice(0, 1).map((e: any) => e.id),
              fillability: Math.min(100, avgQuality + 10),
            },
            {
              premiseKey: "p2",
              premiseTemplate: "E asserts that A is true",
              mappedEvidence: expertEvidence.slice(0, 1).map((e: any) => e.id),
              fillability: Math.min(100, avgRelevance + 15),
            },
            {
              premiseKey: "p3",
              premiseTemplate: "A is within domain D",
              mappedEvidence: expertEvidence.slice(0, 1).map((e: any) => e.id),
              fillability: Math.min(100, avgRelevance),
            },
          ],
          strengthPrediction: {
            expectedStrength: Math.round(matchScore * 0.9),
            confidenceInterval: [
              Math.round(matchScore * 0.75),
              Math.round(Math.min(100, matchScore * 1.05)),
            ] as [number, number],
            keyFactors: [
              avgQuality >= 80 ? "High quality evidence" : null,
              avgCredibility >= 80 ? "Credible sources" : null,
              expertEvidence.length >= 2 ? "Multiple expert sources" : null,
            ].filter(Boolean) as string[],
          },
          requirements: {
            met: [
              "Expert credentials available",
              avgQuality >= 60 ? "Quality evidence" : null,
            ].filter(Boolean) as string[],
            missing: [
              avgQuality < 60 ? "Higher quality evidence recommended" : null,
            ].filter(Boolean) as string[],
            optional: ["Additional expert opinions for stronger support"],
          },
        });
      }

      // Cause to Effect - if we have empirical or causal evidence
      if (evidenceByType["empirical-data"] || evidenceByType["causal-link"] || evidenceByType["statistics"]) {
        const causalEvidence = [
          ...(evidenceByType["empirical-data"] || []),
          ...(evidenceByType["causal-link"] || []),
          ...(evidenceByType["statistics"] || []),
        ];
        const matchScore = Math.min(92, 55 + (causalEvidence.length * 8) + (avgQuality * 0.3));

        mockMatches.push({
          schemeId: "cause-to-effect",
          schemeName: "Argument from Cause to Effect",
          schemeCategory: "Causal",
          matchScore: Math.round(matchScore),
          confidence: Math.round(Math.min(92, avgQuality * 0.7 + 25)),
          reasoning: `Good match: ${causalEvidence.length} empirical/causal evidence items support causal reasoning.`,
          evidenceUtilization: {
            usedEvidence: causalEvidence.map((e: any) => e.id),
            unusedEvidence: evidence.filter((e: any) => !causalEvidence.includes(e)).map((e: any) => e.id),
            utilizationRate: Math.round((causalEvidence.length / evidence.length) * 100),
          },
          premiseMapping: [
            {
              premiseKey: "p1",
              premiseTemplate: "Generally, if A occurs, then B will occur",
              mappedEvidence: causalEvidence.slice(0, 2).map((e: any) => e.id),
              fillability: Math.min(100, avgQuality + 5),
            },
            {
              premiseKey: "p2",
              premiseTemplate: "In this case, A occurs",
              mappedEvidence: causalEvidence.slice(0, 1).map((e: any) => e.id),
              fillability: Math.min(100, avgRelevance + 10),
            },
            {
              premiseKey: "p3",
              premiseTemplate: "No factor prevents B from occurring",
              mappedEvidence: [],
              fillability: 50,
            },
          ],
          strengthPrediction: {
            expectedStrength: Math.round(matchScore * 0.85),
            confidenceInterval: [
              Math.round(matchScore * 0.7),
              Math.round(Math.min(100, matchScore * 1.0)),
            ] as [number, number],
            keyFactors: [
              avgQuality >= 75 ? "Strong empirical evidence" : null,
              causalEvidence.length >= 3 ? "Multiple causal links" : null,
              "Causal mechanism identifiable",
            ].filter(Boolean) as string[],
          },
          requirements: {
            met: [
              "Causal evidence available",
              causalEvidence.length >= 2 ? "Multiple evidence sources" : null,
            ].filter(Boolean) as string[],
            missing: [],
            optional: ["Evidence for absence of preventing factors"],
          },
        });
      }

      // Precedent - if we have case studies or historical data
      if (evidenceByType["case-study"] || evidenceByType["historical-data"] || evidenceByType["example"]) {
        const precedentEvidence = [
          ...(evidenceByType["case-study"] || []),
          ...(evidenceByType["historical-data"] || []),
          ...(evidenceByType["example"] || []),
        ];
        const matchScore = Math.min(88, 50 + (precedentEvidence.length * 12) + (avgRelevance * 0.25));

        mockMatches.push({
          schemeId: "precedent",
          schemeName: "Argument from Precedent",
          schemeCategory: "Inductive",
          matchScore: Math.round(matchScore),
          confidence: Math.round(Math.min(88, avgRelevance * 0.75 + 20)),
          reasoning: `Moderate match: ${precedentEvidence.length} case studies/examples demonstrate precedent.`,
          evidenceUtilization: {
            usedEvidence: precedentEvidence.map((e: any) => e.id),
            unusedEvidence: evidence.filter((e: any) => !precedentEvidence.includes(e)).map((e: any) => e.id),
            utilizationRate: Math.round((precedentEvidence.length / evidence.length) * 100),
          },
          premiseMapping: [
            {
              premiseKey: "p1",
              premiseTemplate: "In previous similar case C1, decision D1 was made",
              mappedEvidence: precedentEvidence.slice(0, 2).map((e: any) => e.id),
              fillability: Math.min(100, avgRelevance + 10),
            },
            {
              premiseKey: "p2",
              premiseTemplate: "Current case C2 is similar to C1",
              mappedEvidence: precedentEvidence.slice(0, 1).map((e: any) => e.id),
              fillability: Math.min(100, avgRelevance),
            },
            {
              premiseKey: "p3",
              premiseTemplate: "There are no relevant differences between C1 and C2",
              mappedEvidence: [],
              fillability: 45,
            },
          ],
          strengthPrediction: {
            expectedStrength: Math.round(matchScore * 0.88),
            confidenceInterval: [
              Math.round(matchScore * 0.75),
              Math.round(Math.min(100, matchScore * 1.0)),
            ] as [number, number],
            keyFactors: [
              precedentEvidence.length >= 2 ? "Multiple precedents" : null,
              avgRelevance >= 80 ? "Highly relevant cases" : null,
            ].filter(Boolean) as string[],
          },
          requirements: {
            met: [
              "Precedent cases available",
            ],
            missing: [
              avgRelevance < 70 ? "More relevant precedents recommended" : null,
            ].filter(Boolean) as string[],
            optional: ["Analysis of case differences"],
          },
        });
      }

      // General scheme - always available as fallback
      mockMatches.push({
        schemeId: "general-support",
        schemeName: "General Support Argument",
        schemeCategory: "General",
        matchScore: Math.round(Math.max(40, avgQuality * 0.5 + avgRelevance * 0.3 + 10)),
        confidence: Math.round(Math.max(50, avgQuality * 0.6 + 20)),
        reasoning: `General purpose scheme suitable for any evidence type.`,
        evidenceUtilization: {
          usedEvidence: evidence.map((e: any) => e.id),
          unusedEvidence: [],
          utilizationRate: 100,
        },
        premiseMapping: [
          {
            premiseKey: "p1",
            premiseTemplate: "Evidence E supports claim C",
            mappedEvidence: evidence.slice(0, 3).map((e: any) => e.id),
            fillability: Math.min(100, avgQuality * 0.8 + 20),
          },
          {
            premiseKey: "p2",
            premiseTemplate: "E is credible and relevant",
            mappedEvidence: evidence.slice(0, 2).map((e: any) => e.id),
            fillability: Math.min(100, (avgCredibility + avgRelevance) / 2),
          },
        ],
        strengthPrediction: {
          expectedStrength: Math.round((avgQuality + avgRelevance) / 2),
          confidenceInterval: [
            Math.round((avgQuality + avgRelevance) / 2 * 0.8),
            Math.round(Math.min(100, (avgQuality + avgRelevance) / 2 * 1.2)),
          ] as [number, number],
          keyFactors: [
            evidence.length >= 3 ? "Multiple evidence sources" : null,
            avgQuality >= 70 ? "Good evidence quality" : null,
          ].filter(Boolean) as string[],
        },
        requirements: {
          met: ["Evidence available"],
          missing: [],
          optional: ["Specialized scheme for stronger argument"],
        },
      });

      // Sort by match score
      mockMatches.sort((a, b) => b.matchScore - a.matchScore);

      return NextResponse.json({ matches: mockMatches });
    }

    // For production: call real service
    // const service = new EvidenceSchemeMatchingService();
    // const matches = await service.matchEvidenceToSchemes(evidence, targetArgumentId);

    return NextResponse.json(
      { error: "Real service not implemented yet" },
      { status: 501 }
    );
  } catch (error: any) {
    console.error("Evidence-scheme matching error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to match evidence to schemes" },
      { status: 500 }
    );
  }
}
