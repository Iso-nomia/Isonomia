// app/api/deliberations/[id]/assumption-graph/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/deliberations/[id]/assumption-graph
 * 
 * Generate full assumption dependency graph for visualization.
 * 
 * Response:
 * {
 *   ok: true,
 *   nodes: Array<{
 *     id: string,
 *     type: "claim" | "argument" | "derivation" | "assumption",
 *     label: string,
 *     metadata: Record<string, any>
 *   }>,
 *   edges: Array<{
 *     from: string,
 *     to: string,
 *     type: "supports" | "uses" | "inferred",
 *     weight?: number
 *   }>
 * }
 * 
 * Graph Structure:
 *   Claim C
 *     ↑ supports
 *   Argument A
 *     ↑ materializes
 *   Derivation d₁
 *     → uses (weight=0.8)
 *     Assumption λ₁
 *       ↑ inferred
 *     Derivation d₀ (parent via compose)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = decodeURIComponent(String(params.id || "")).trim();
  
  if (!deliberationId) {
    return NextResponse.json(
      { error: "Missing deliberation ID" },
      { status: 400 }
    );
  }

  try {
    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, title: true }
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // Fetch all arguments in this deliberation
    const args = await prisma.argument.findMany({
      where: { deliberationId },
      select: { id: true, claimId: true, text: true }
    });

    const argumentIds = args.map(a => a.id);

    // Fetch all derivations (ArgumentSupport)
    const derivations = await prisma.argumentSupport.findMany({
      where: { argumentId: { in: argumentIds } },
      select: { id: true, argumentId: true, claimId: true }
    });

    const derivationIds = derivations.map(d => d.id);

    // Fetch all DerivationAssumption links
    const derivAssums = await prisma.derivationAssumption.findMany({
      where: { derivationId: { in: derivationIds } }
    });

    // Fetch all assumptions
    const assumptionIds = [...new Set(derivAssums.map(da => da.assumptionId))];
    const assumptions = await prisma.assumptionUse.findMany({
      where: {
        id: { in: assumptionIds },
        status: "ACCEPTED"
      }
    });

    // Fetch all claims
    const claimIds = [
      ...new Set([
        ...args.map(a => a.claimId).filter((id): id is string => id !== null),
        ...derivations.map(d => d.claimId),
        ...assumptions.map(a => a.assumptionClaimId).filter((id): id is string => id !== null)
      ])
    ];

    const claims = await prisma.claim.findMany({
      where: { id: { in: claimIds } },
      select: { id: true, text: true }
    });

    // Build nodes
    const nodes: Array<{
      id: string;
      type: "claim" | "argument" | "derivation" | "assumption";
      label: string;
      metadata: Record<string, any>;
    }> = [];

    // Add claim nodes
    for (const claim of claims) {
      nodes.push({
        id: claim.id,
        type: "claim",
        label: claim.text.substring(0, 100) + (claim.text.length > 100 ? "..." : ""),
        metadata: { fullText: claim.text }
      });
    }

    // Add argument nodes
    for (const arg of args) {
      nodes.push({
        id: arg.id,
        type: "argument",
        label: arg.text?.substring(0, 100) || `Argument for ${arg.claimId}`,
        metadata: { claimId: arg.claimId }
      });
    }

    // Add derivation nodes
    for (const deriv of derivations) {
      nodes.push({
        id: deriv.id,
        type: "derivation",
        label: `Derivation → ${deriv.claimId}`,
        metadata: { 
          argumentId: deriv.argumentId, 
          claimId: deriv.claimId 
        }
      });
    }

    // Add assumption nodes
    const claimMap = new Map(claims.map(c => [c.id, c]));
    for (const assump of assumptions) {
      const claimText = assump.assumptionClaimId 
        ? claimMap.get(assump.assumptionClaimId)?.text 
        : null;
      const label = claimText || assump.assumptionText || "Assumption";
      
      nodes.push({
        id: assump.id,
        type: "assumption",
        label: label.substring(0, 100) + (label.length > 100 ? "..." : ""),
        metadata: {
          role: assump.role,
          claimId: assump.assumptionClaimId
        }
      });
    }

    // Build edges
    const edges: Array<{
      from: string;
      to: string;
      type: "supports" | "uses" | "inferred";
      weight?: number;
    }> = [];

    // Argument → Claim edges (supports)
    for (const arg of args) {
      if (!arg.claimId) continue;
      edges.push({
        from: arg.id,
        to: arg.claimId,
        type: "supports"
      });
    }

    // Derivation → Argument edges (materializes)
    for (const deriv of derivations) {
      edges.push({
        from: deriv.id,
        to: deriv.argumentId,
        type: "supports"
      });
    }

    // Derivation → Assumption edges (uses)
    const assumptionSet = new Set(assumptions.map(a => a.id));
    for (const da of derivAssums) {
      // Only include edges where assumption is ACCEPTED
      if (!assumptionSet.has(da.assumptionId)) continue;

      edges.push({
        from: da.derivationId,
        to: da.assumptionId,
        type: "uses",
        weight: da.weight
      });

      // If transitive, add edge from parent derivation
      if (da.inferredFrom) {
        edges.push({
          from: da.inferredFrom,
          to: da.derivationId,
          type: "inferred"
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        deliberationId,
        deliberationTitle: deliberation.title,
        nodes,
        edges,
        stats: {
          claims: claims.length,
          arguments: args.length,
          derivations: derivations.length,
          assumptions: assumptions.length,
          links: derivAssums.length
        }
      },
      NO_STORE
    );
  } catch (error: any) {
    console.error("Error generating assumption graph:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
