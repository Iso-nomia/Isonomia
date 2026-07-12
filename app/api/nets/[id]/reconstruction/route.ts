export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { NetReconstructionService } from "@/app/server/services/NetReconstructionService";
import { NetIdentificationService } from "@/app/server/services/NetIdentificationService";
import { DependencyInferenceEngine } from "@/app/server/services/DependencyInferenceEngine";
import { ExplicitnessClassifier } from "@/app/server/services/ExplicitnessClassifier";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const planOnly = searchParams.get("plan") === "true";

    const reconstructionService = new NetReconstructionService();
    const netService = new NetIdentificationService();
    const dependencyEngine = new DependencyInferenceEngine();
    const classifier = new ExplicitnessClassifier();

    // Fetch the argument
    const argument = await prisma.argument.findUnique({
      where: { id: params.id },
      include: {
        premises: true,
        conclusion: true,
      },
    });

    if (!argument) {
      return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    }

    // Detect net
    const net = await netService.detectMultiScheme(params.id);

    if (!net) {
      return NextResponse.json(
        { error: "No net detected for this argument" },
        { status: 404 }
      );
    }

    // Infer dependencies
    const dependencyGraph = await dependencyEngine.inferDependencies(net);

    // Build argument text
    const argumentText = [
      ...argument.premises.map((p: any) => p.text),
      argument.conclusion?.text || "",
    ].join(" ");

    // Classify explicitness
    const explicitnessAnalysis = await classifier.classifyExplicitness(
      net,
      dependencyGraph,
      argumentText
    );

    if (planOnly) {
      // Return full reconstruction plan
      const plan = await reconstructionService.createReconstructionPlan(
        net,
        dependencyGraph,
        explicitnessAnalysis
      );
      return NextResponse.json({ plan });
    } else {
      // Return just suggestions
      const suggestions = await reconstructionService.generateSuggestions(
        net,
        dependencyGraph,
        explicitnessAnalysis
      );
      return NextResponse.json({ suggestions });
    }
  } catch (error) {
    console.error("Reconstruction error:", error);
    return NextResponse.json(
      { error: "Failed to generate reconstruction suggestions" },
      { status: 500 }
    );
  }
}
