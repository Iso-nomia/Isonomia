export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { getNodeProvenance } from "@/lib/aif/graph-builder";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/aif/nodes/[nodeId]/provenance
 * 
 * Returns dialogue move provenance for a specific AIF node.
 * Shows which dialogue move created it, what edges it caused,
 * and which moves referenced it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  try {
    // Get current user ID for authorization
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { nodeId } = params;

    if (!nodeId) {
      return NextResponse.json(
        { error: "Missing nodeId parameter" },
        { status: 400 }
      );
    }

    // Get node to verify it exists
    const node = await (prisma as any).aifNode.findUnique({
      where: { id: nodeId },
      select: { id: true, deliberationId: true },
    });

    if (!node) {
      return NextResponse.json(
        { error: "Node not found" },
        { status: 404 }
      );
    }

    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: node.deliberationId },
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // Get the provenance information
    const provenance = await getNodeProvenance(nodeId, node.deliberationId);

    return NextResponse.json(provenance, { status: 200 });
  } catch (error) {
    console.error("Error getting node provenance:", error);
    return NextResponse.json(
      { error: "Failed to get node provenance" },
      { status: 500 }
    );
  }
}
