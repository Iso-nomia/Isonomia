export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ExplicitnessClassifier } from "@/app/server/services/ExplicitnessClassifier";
import { NetIdentificationService } from "@/app/server/services/NetIdentificationService";
import { DependencyInferenceEngine } from "@/app/server/services/DependencyInferenceEngine";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const classifier = new ExplicitnessClassifier();
    const netService = new NetIdentificationService();
    const dependencyEngine = new DependencyInferenceEngine();

    // Fetch the argument to get net candidate
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
      return NextResponse.json({ error: "No net detected for this argument" }, { status: 404 });
    }

    // Infer dependencies
    const dependencyGraph = await dependencyEngine.inferDependencies(net);

    // Build argument text for analysis
    const argumentText = [
      ...argument.premises.map((p: any) => p.text),
      argument.conclusion?.text || "",
    ].join(" ");

    // Classify explicitness
    const analysis = await classifier.classifyExplicitness(
      net,
      dependencyGraph,
      argumentText
    );

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Explicitness classification error:", error);
    return NextResponse.json(
      { error: "Failed to classify explicitness" },
      { status: 500 }
    );
  }
}
