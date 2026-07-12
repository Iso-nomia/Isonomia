export const dynamic = "force-dynamic";

/**
 * Batch Argument Generation API
 * 
 * POST /api/arguments/batch-generate
 * Generates multiple support arguments simultaneously
 * 
 * Phase 3.4: Support Generator
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      targetArgumentId,
      maxArguments,
      minStrength,
      diversityMode,
      evidenceStrategy,
      evidence,
    } = body;

    if (!evidence || !Array.isArray(evidence)) {
      return NextResponse.json(
        { error: "Evidence array is required" },
        { status: 400 }
      );
    }

    // Mock batch generation for testing (replace with real service in production)
    const isTestMode = true;

    if (isTestMode) {
      // Calculate evidence metrics
      const avgQuality = evidence.reduce((sum: number, e: any) => sum + (e.quality || 50), 0) / evidence.length;
      const avgCredibility = evidence.reduce((sum: number, e: any) => sum + (e.credibility || 50), 0) / evidence.length;
      const avgRelevance = evidence.reduce((sum: number, e: any) => sum + (e.relevance || 50), 0) / evidence.length;

      // Group evidence by type
      const evidenceByType = evidence.reduce((acc: any, e: any) => {
        acc[e.type] = acc[e.type] || [];
        acc[e.type].push(e);
        return acc;
      }, {});

      const generatedArguments = [];
      const usedEvidence = new Set<string>();

      // Helper to allocate evidence based on strategy
      function allocateEvidence(preferredTypes: string[], count: number) {
        const allocated = [];
        
        if (evidenceStrategy === "distribute") {
          // Use unique evidence only
          for (const type of preferredTypes) {
            if (!evidenceByType[type]) continue;
            for (const e of evidenceByType[type]) {
              if (!usedEvidence.has(e.id) && allocated.length < count) {
                allocated.push(e);
                usedEvidence.add(e.id);
              }
            }
            if (allocated.length >= count) break;
          }
        } else if (evidenceStrategy === "duplicate") {
          // Allow reuse
          for (const type of preferredTypes) {
            if (!evidenceByType[type]) continue;
            allocated.push(...evidenceByType[type].slice(0, count));
            if (allocated.length >= count) break;
          }
        } else if (evidenceStrategy === "prioritize") {
          // Use highest quality
          const sorted = evidence
            .filter((e: any) => preferredTypes.includes(e.type))
            .sort((a: any, b: any) => b.quality - a.quality);
          allocated.push(...sorted.slice(0, count));
        }
        
        return allocated.slice(0, count);
      }

      // Generate Expert Opinion argument if we have expert evidence
      if (
        (evidenceByType["expert-opinion"] || evidenceByType["expert-credentials"]) &&
        generatedArguments.length < (maxArguments || 5)
      ) {
        const expertEvidence = allocateEvidence(["expert-opinion", "expert-credentials"], 3);
        const strength = Math.min(95, 70 + (expertEvidence.length * 5) + (avgQuality * 0.2));

        if (strength >= (minStrength || 60)) {
          generatedArguments.push({
            id: `gen-${Date.now()}-1`,
            schemeId: "expert-opinion",
            schemeName: "Argument from Expert Opinion",
            premises: {
              p1: expertEvidence[0] ? `${expertEvidence[0].title} is an expert in the relevant domain` : "Expert credentials verified",
              p2: expertEvidence[0] ? `According to ${expertEvidence[0].title}, the claim is supported` : "Expert asserts the claim",
              p3: "The claim falls within the expert's domain of expertise",
            },
            evidence: {
              p1: [expertEvidence[0]?.id].filter(Boolean),
              p2: [expertEvidence[0]?.id].filter(Boolean),
              p3: expertEvidence.slice(0, 2).map((e: any) => e.id),
            },
            strength: Math.round(strength),
            reasoning: `Strong expert-based support with ${expertEvidence.length} expert sources (${Math.round(avgCredibility)}% credibility)`,
            status: "generated" as const,
          });
        }
      }

      // Generate Cause to Effect if we have empirical evidence
      if (
        (evidenceByType["empirical-data"] || evidenceByType["statistics"]) &&
        generatedArguments.length < (maxArguments || 5)
      ) {
        const empiricalEvidence = allocateEvidence(["empirical-data", "statistics", "causal-link"], 3);
        const strength = Math.min(92, 68 + (empiricalEvidence.length * 6) + (avgQuality * 0.18));

        if (strength >= (minStrength || 60)) {
          generatedArguments.push({
            id: `gen-${Date.now()}-2`,
            schemeId: "cause-to-effect",
            schemeName: "Argument from Cause to Effect",
            premises: {
              p1: "Empirical evidence shows a causal relationship between the factors",
              p2: empiricalEvidence[0] ? `Data demonstrates: ${empiricalEvidence[0].title}` : "The causal factor is present",
              p3: "No preventing factors interfere with the effect",
            },
            evidence: {
              p1: empiricalEvidence.slice(0, 2).map((e: any) => e.id),
              p2: [empiricalEvidence[0]?.id].filter(Boolean),
              p3: [],
            },
            strength: Math.round(strength),
            reasoning: `Empirical support with ${empiricalEvidence.length} data sources (${Math.round(avgQuality)}% quality)`,
            status: "generated" as const,
          });
        }
      }

      // Generate Precedent argument if we have case studies
      if (
        (evidenceByType["case-study"] || evidenceByType["historical-data"]) &&
        generatedArguments.length < (maxArguments || 5)
      ) {
        const precedentEvidence = allocateEvidence(["case-study", "historical-data", "example"], 3);
        const strength = Math.min(88, 65 + (precedentEvidence.length * 7) + (avgRelevance * 0.2));

        if (strength >= (minStrength || 60)) {
          generatedArguments.push({
            id: `gen-${Date.now()}-3`,
            schemeId: "precedent",
            schemeName: "Argument from Precedent",
            premises: {
              p1: precedentEvidence[0] ? `Historical case: ${precedentEvidence[0].title}` : "Similar precedent exists",
              p2: "Current situation is analogous to the precedent",
              p3: "No relevant differences undermine the comparison",
            },
            evidence: {
              p1: precedentEvidence.slice(0, 2).map((e: any) => e.id),
              p2: [precedentEvidence[0]?.id].filter(Boolean),
              p3: [],
            },
            strength: Math.round(strength),
            reasoning: `Precedent-based argument with ${precedentEvidence.length} cases (${Math.round(avgRelevance)}% relevance)`,
            status: "generated" as const,
          });
        }
      }

      // Generate Analogy argument if diverse evidence
      if (evidence.length >= 2 && generatedArguments.length < (maxArguments || 5)) {
        const analogyEvidence = allocateEvidence(Object.keys(evidenceByType), 2);
        const strength = Math.min(80, 62 + (avgRelevance * 0.3));

        if (strength >= (minStrength || 60)) {
          generatedArguments.push({
            id: `gen-${Date.now()}-4`,
            schemeId: "analogy",
            schemeName: "Argument from Analogy",
            premises: {
              p1: "Source case shares key characteristics with target",
              p2: analogyEvidence[0] ? `Evidence from: ${analogyEvidence[0].title}` : "Relevant similarities identified",
              p3: "Differences are not significant enough to break the analogy",
            },
            evidence: {
              p1: [analogyEvidence[0]?.id].filter(Boolean),
              p2: analogyEvidence.map((e: any) => e.id),
              p3: [],
            },
            strength: Math.round(strength),
            reasoning: `Analogical reasoning with ${analogyEvidence.length} comparative sources`,
            status: "generated" as const,
          });
        }
      }

      // Generate General Support as fallback
      if (generatedArguments.length < Math.min(2, maxArguments || 5)) {
        const generalEvidence = evidence.slice(0, 3);
        const strength = Math.min(75, 60 + (avgQuality * 0.15) + (avgRelevance * 0.15));

        if (strength >= (minStrength || 60)) {
          generatedArguments.push({
            id: `gen-${Date.now()}-5`,
            schemeId: "general-support",
            schemeName: "General Support Argument",
            premises: {
              p1: "Available evidence supports the target claim",
              p2: "The evidence is credible and relevant",
            },
            evidence: {
              p1: generalEvidence.map((e: any) => e.id),
              p2: generalEvidence.slice(0, 2).map((e: any) => e.id),
            },
            strength: Math.round(strength),
            reasoning: `General support with ${generalEvidence.length} evidence items (${Math.round((avgQuality + avgRelevance) / 2)}% overall quality)`,
            status: "generated" as const,
          });
        }
      }

      // Apply diversity mode
      let finalArguments = generatedArguments;
      if (diversityMode === "maximize") {
        // Ensure unique categories
        const seen = new Set<string>();
        finalArguments = generatedArguments.filter((arg) => {
          if (seen.has(arg.schemeId)) return false;
          seen.add(arg.schemeId);
          return true;
        });
      } else if (diversityMode === "focused") {
        // Sort by strength, take top N
        finalArguments = generatedArguments
          .sort((a, b) => b.strength - a.strength)
          .slice(0, maxArguments || 5);
      }
      // "balanced" uses the natural order

      // Limit to maxArguments
      finalArguments = finalArguments.slice(0, maxArguments || 5);

      return NextResponse.json({ arguments: finalArguments });
    }

    // For production: call real service
    // const service = new BatchGenerationService();
    // const arguments = await service.generateBatch(body);

    return NextResponse.json(
      { error: "Real service not implemented yet" },
      { status: 501 }
    );
  } catch (error: any) {
    console.error("Batch generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate batch arguments" },
      { status: 500 }
    );
  }
}
