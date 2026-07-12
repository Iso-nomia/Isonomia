// app/api/arguments/[id]/minimal-assumptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/arguments/[id]/minimal-assumptions
 * 
 * Compute minimal set of assumptions for all derivations of an argument.
 * 
 * Response:
 * {
 *   ok: true,
 *   argumentId: string,
 *   derivations: Array<{
 *     derivationId: string,
 *     claimId: string,
 *     assumptions: Array<{
 *       id: string,
 *       text: string,
 *       weight: number,
 *       transitive: boolean     // True if inferred from composition
 *     }>
 *   }>,
 *   minimalSet: Array<{          // Union of all assumptions
 *     id: string,
 *     text: string,
 *     usedByDerivations: string[],  // Which derivations use this
 *     criticalityScore: number      // How many derivations depend on it (0..1)
 *   }>
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const argumentId = decodeURIComponent(String(params.id || "")).trim();
  
  if (!argumentId) {
    return NextResponse.json(
      { error: "Missing argument ID" },
      { status: 400 }
    );
  }

  try {
    // Verify argument exists
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { id: true, claimId: true }
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404 }
      );
    }

    // Fetch all ArgumentSupport (derivations) for this argument
    const supports = await prisma.argumentSupport.findMany({
      where: { argumentId },
      select: { id: true, claimId: true }
    });

    if (supports.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          argumentId,
          derivations: [],
          minimalSet: []
        },
        NO_STORE
      );
    }

    const derivationIds = supports.map(s => s.id);

    // Fetch all DerivationAssumption links for these derivations
    const derivAssums = await prisma.derivationAssumption.findMany({
      where: { derivationId: { in: derivationIds } }
    });

    // Fetch all related AssumptionUse records
    const assumptionIds = [...new Set(derivAssums.map(da => da.assumptionId))];
    const assumptions = await prisma.assumptionUse.findMany({
      where: {
        id: { in: assumptionIds },
        status: "ACCEPTED"  // Only include accepted assumptions
      }
    });

    // Fetch related claims for assumption text
    const claimIds = assumptions
      .map(a => a.assumptionClaimId)
      .filter((id): id is string => id !== null);
    
    const claims = await prisma.claim.findMany({
      where: { id: { in: claimIds } },
      select: { id: true, text: true }
    });

    const claimMap = new Map(claims.map(c => [c.id, c]));
    const assumptionMap = new Map(assumptions.map(a => [a.id, a]));

    // Build derivations response
    const derivationData = supports.map(support => {
      const derivAssumptions = derivAssums.filter(da => da.derivationId === support.id);
      
      return {
        derivationId: support.id,
        claimId: support.claimId,
        assumptions: derivAssumptions.map(da => {
          const assump = assumptionMap.get(da.assumptionId);
          const claimText = assump?.assumptionClaimId 
            ? claimMap.get(assump.assumptionClaimId)?.text 
            : null;
          
          return {
            id: da.assumptionId,
            text: claimText || assump?.assumptionText || "(no text)",
            weight: da.weight,
            transitive: da.inferredFrom !== null
          };
        })
      };
    });

    // Build minimal set with reverse index
    const minimalAssumptionMap = new Map<string, {
      id: string;
      text: string;
      derivationIds: Set<string>;
    }>();

    for (const da of derivAssums) {
      const assump = assumptionMap.get(da.assumptionId);
      if (!assump) continue;  // Skip if not ACCEPTED

      if (!minimalAssumptionMap.has(da.assumptionId)) {
        const claimText = assump.assumptionClaimId 
          ? claimMap.get(assump.assumptionClaimId)?.text 
          : null;
        
        minimalAssumptionMap.set(da.assumptionId, {
          id: da.assumptionId,
          text: claimText || assump.assumptionText || "(no text)",
          derivationIds: new Set()
        });
      }
      
      minimalAssumptionMap.get(da.assumptionId)!.derivationIds.add(da.derivationId);
    }

    // Compute criticality scores
    const totalDerivations = supports.length;
    const minimalSet = Array.from(minimalAssumptionMap.values()).map(a => ({
      id: a.id,
      text: a.text,
      usedByDerivations: Array.from(a.derivationIds),
      criticalityScore: a.derivationIds.size / totalDerivations
    })).sort((a, b) => b.criticalityScore - a.criticalityScore);

    return NextResponse.json(
      {
        ok: true,
        argumentId,
        derivations: derivationData,
        minimalSet
      },
      NO_STORE
    );
  } catch (error: any) {
    console.error("Error computing minimal assumptions:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
