// app/api/deliberations/[id]/ceg/mini/[claimId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/deliberations/[id]/ceg/mini/[claimId]
 * 
 * Fetches CEG (Critical Evaluation Graph) data for a specific claim.
 * Returns enriched node data including label, confidence, metrics, and dialogical status.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; claimId: string } }
) {
  const deliberationId = decodeURIComponent(params.id);
  const claimId = decodeURIComponent(params.claimId);

  if (!deliberationId || !claimId) {
    return NextResponse.json(
      { error: "Missing deliberationId or claimId" },
      { status: 400 }
    );
  }

  try {
    // Fetch the claim with its label
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        text: true,
        createdAt: true,
        deliberationId: true,
        ClaimLabel: {
          select: {
            label: true,
            explainJson: true,
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (claim.deliberationId !== deliberationId) {
      return NextResponse.json(
        { error: "Claim does not belong to this deliberation" },
        { status: 400 }
      );
    }

    // Fetch edges (supports/rebuts/undercuts) involving this claim
    const edges = await prisma.claimEdge.findMany({
      where: {
        OR: [{ fromClaimId: claimId }, { toClaimId: claimId }],
      },
      select: {
        id: true,
        fromClaimId: true,
        toClaimId: true,
        attackType: true,
        targetScope: true,
      },
    });

    // Calculate metrics (using default weight of 0.7 per edge)
    const defaultEdgeWeight = 0.7;
    const inDegree = edges.filter((e) => e.toClaimId === claimId).length;
    const outDegree = edges.filter((e) => e.fromClaimId === claimId).length;
    
    const supportEdges = edges.filter(
      (e) => e.toClaimId === claimId && e.attackType === "SUPPORTS"
    );
    const attackEdges = edges.filter(
      (e) => e.toClaimId === claimId && 
      (e.attackType === "REBUTS" || e.attackType === "UNDERCUTS" || e.attackType === "UNDERMINES")
    );

    const supportStrength = supportEdges.length * defaultEdgeWeight;
    const attackStrength = attackEdges.length * defaultEdgeWeight;
    const netStrength = supportStrength - attackStrength;

    // Check if controversial (roughly balanced support vs attack)
    const isControversial = 
      supportEdges.length > 0 && 
      attackEdges.length > 0 && 
      Math.abs(supportStrength - attackStrength) < 1.0;

    // Build response
    const label = claim.ClaimLabel?.label || "UNDEC";
    const confidence = 0.7; // Default confidence matching CEG mini endpoint

    const node = {
      id: claim.id,
      type: "claim" as const,
      text: claim.text,
      label: label as "IN" | "OUT" | "UNDEC",
      confidence,
      approvals: 0, // Could fetch from ArgumentApproval if needed
      supportStrength,
      attackStrength,
      netStrength,
      inDegree,
      outDegree,
      centrality: inDegree + outDegree, // Simple centrality metric
      isControversial,
      createdAt: claim.createdAt.toISOString(),
      explainJson: claim.ClaimLabel?.explainJson || null,
    };

    return NextResponse.json(
      {
        ok: true,
        node,
        edges: edges.map((e) => ({
          id: e.id,
          source: e.fromClaimId,
          target: e.toClaimId,
          type: e.attackType === "SUPPORTS" ? "supports" : 
                e.attackType === "REBUTS" ? "rebuts" : "undercuts",
          attackType: e.attackType,
          targetScope: e.targetScope,
          confidence: defaultEdgeWeight,
        })),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Error fetching CEG data for claim:", error);
    return NextResponse.json(
      { error: "Failed to fetch CEG data" },
      { status: 500 }
    );
  }
}
