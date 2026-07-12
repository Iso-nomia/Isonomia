export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { DependencyInferenceEngine } from "@/app/server/services/DependencyInferenceEngine";
import { NetIdentificationService } from "@/app/server/services/NetIdentificationService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const engine = new DependencyInferenceEngine();
    const netService = new NetIdentificationService();

    // For now, we'll use the argumentId as the net ID
    // In production, you'd fetch the actual net from the database
    const net = await netService.detectMultiScheme(params.id);

    if (!net) {
      return NextResponse.json({ error: "Net not found" }, { status: 404 });
    }

    // Infer dependencies
    const dependencyGraph = await engine.inferDependencies(net);

    return NextResponse.json({ graph: dependencyGraph });
  } catch (error) {
    console.error("Dependency inference error:", error);
    return NextResponse.json(
      { error: "Failed to infer dependencies" },
      { status: 500 }
    );
  }
}
