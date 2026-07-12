export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { NetAwareCQService } from "@/app/server/services/NetAwareCQService";
import { NetIdentificationService } from "@/app/server/services/NetIdentificationService";
import { DependencyInferenceEngine } from "@/app/server/services/DependencyInferenceEngine";
import { ExplicitnessClassifier } from "@/app/server/services/ExplicitnessClassifier";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = request.nextUrl;
    const groupBy = searchParams.get("groupBy") as any;
    const netId = params.id;

    // Try to fetch explicit SchemeNet from database first (Phase 4+)
    const schemeNet = await prisma.schemeNet.findUnique({
      where: { id: netId },
      include: {
        steps: {
          include: {
            scheme: {
              include: {
                cqs: true,
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
        argument: {
          include: {
            premises: true,
            deliberation: true,
          },
        },
      },
    });

    // If explicit SchemeNet exists, use it directly
    if (schemeNet) {
      // Build net structure for CQ generation
      const net = {
        netId: schemeNet.id,
        netType: "serial",
        overallConfidence: 0.9,
        schemes: schemeNet.steps.map((step, index) => ({
          schemeId: step.schemeId,
          schemeName: step.scheme.name || `Scheme ${index + 1}`,
          schemeCategory: (step.scheme as any).category || "general",
          confidence: 0.9 - (index * 0.02),
          premises: [],
          conclusions: [],
          role: step.stepOrder === 1 ? "primary" : "supporting",
        })),
      } as any;

      // Get argument text
      const argumentText = schemeNet.argument.premises.map((p: any) => p.text).join(" ");

      // Analyze net
      const depEngine = new DependencyInferenceEngine();
      const classifier = new ExplicitnessClassifier();
      const cqService = new NetAwareCQService();

      const dependencyGraph = await depEngine.inferDependencies(net);
      const explicitnessAnalysis = await classifier.classifyExplicitness(
        net,
        dependencyGraph,
        argumentText
      );

      // Generate CQs
      const questions = await cqService.generateNetCQs(
        schemeNet.argumentId,
        net,
        dependencyGraph,
        explicitnessAnalysis
      );

      // Group if requested
      if (groupBy) {
        const groups = cqService.groupCQs(questions, groupBy);
        return NextResponse.json({ groups, totalQuestions: questions.length });
      }

      return NextResponse.json({ questions });
    }

    // FALLBACK: If no explicit SchemeNet, try detecting from argument
    // Fetch net - for now using mock detection
    // TODO: Replace with actual database fetch when ArgumentNet model exists
    const netService = new NetIdentificationService();
    
    // Mock: fetch argument and detect net
    const argument = await prisma.argument.findUnique({
      where: { id: netId },
      include: { 
        premises: true,
        deliberation: true,
      },
    });

    if (!argument) {
      return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    }

    // Detect net structure
    const net = await netService.detectMultiScheme(netId);
    
    if (!net) {
      return NextResponse.json({ error: "Net not found" }, { status: 404 });
    }

    // Get argument text for explicitness analysis
    const argumentText = (argument.premises.map((p: any) => p.text) || [])
      .filter(Boolean)
      .join(" ");

    // Analyze net
    const depEngine = new DependencyInferenceEngine();
    const classifier = new ExplicitnessClassifier();

    const dependencyGraph = await depEngine.inferDependencies(net);
    const explicitnessAnalysis = await classifier.classifyExplicitness(
      net,
      dependencyGraph,
      argumentText
    );

    // Generate CQs
    const cqService = new NetAwareCQService();
    const questions = await cqService.generateNetCQs(
      params.id,
      net,
      dependencyGraph,
      explicitnessAnalysis
    );

    // Group if requested
    if (groupBy) {
      const groups = cqService.groupCQs(questions, groupBy);
      return NextResponse.json({ groups, totalQuestions: questions.length });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Net CQ generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate critical questions";
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
