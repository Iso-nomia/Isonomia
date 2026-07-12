// app/api/derivations/[id]/assumptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/derivations/[id]/assumptions
 * 
 * Fetch all assumptions for a specific derivation.
 * 
 * Query params:
 *   - includeAll: If "true", include all assumption statuses (default: only ACCEPTED)
 * 
 * Response:
 * {
 *   ok: true,
 *   derivationId: string,
 *   assumptions: Array<{
 *     id: string,                    // AssumptionUse.id
 *     assumptionText: string | null,
 *     assumptionClaimId: string | null,
 *     assumptionClaim?: {            // Populated if assumptionClaimId exists
 *       id: string,
 *       text: string
 *     },
 *     weight: number,                // 0..1
 *     role: string,                  // "premise" | "warrant" | "value"
 *     status: "PROPOSED" | "ACCEPTED" | "CHALLENGED" | "RETRACTED",
 *     inferredFrom: string | null    // Parent derivation if transitive
 *   }>
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const derivationId = decodeURIComponent(String(params.id || "")).trim();
  
  if (!derivationId) {
    return NextResponse.json(
      { error: "Missing derivation ID" },
      { status: 400 }
    );
  }

  const u = new URL(req.url);
  const includeAll = u.searchParams.get("includeAll") === "true";

  try {
    // Verify derivation exists (ArgumentSupport for now)
    const derivation = await prisma.argumentSupport.findUnique({
      where: { id: derivationId },
      select: { id: true, argumentId: true }
    });

    if (!derivation) {
      return NextResponse.json(
        { error: "Derivation not found" },
        { status: 404 }
      );
    }

    // Fetch all DerivationAssumption links for this derivation
    const derivAssums = await prisma.derivationAssumption.findMany({
      where: { derivationId },
      orderBy: { weight: "desc" }
    });

    // Manual join to AssumptionUse since relations not yet defined
    const assumptionIds = derivAssums.map((da) => da.assumptionId);
    
    const assumptions = await prisma.assumptionUse.findMany({
      where: {
        id: { in: assumptionIds },
        ...(includeAll ? {} : { status: "ACCEPTED" })
      }
    });

    // Fetch related claims if they exist
    const claimIds = assumptions
      .map(a => a.assumptionClaimId)
      .filter((id): id is string => id !== null);
    
    const claims = await prisma.claim.findMany({
      where: { id: { in: claimIds } },
      select: { id: true, text: true }
    });

    const claimMap = new Map(claims.map(c => [c.id, c]));

    // Build response with weights and inferredFrom from DerivationAssumption
    const derivAssumMap = new Map(derivAssums.map((da) => [da.assumptionId, da]));

    const result = assumptions.map((a) => {
      const link = derivAssumMap.get(a.id);
      return {
        id: a.id,
        assumptionText: a.assumptionText,
        assumptionClaimId: a.assumptionClaimId,
        assumptionClaim: a.assumptionClaimId 
          ? claimMap.get(a.assumptionClaimId) 
          : undefined,
        weight: link?.weight ?? a.weight ?? 1.0,
        role: a.role,
        status: a.status,
        inferredFrom: link?.inferredFrom ?? null
      };
    });

    return NextResponse.json(
      {
        ok: true,
        derivationId,
        assumptions: result
      },
      NO_STORE
    );
  } catch (error: any) {
    console.error("Error fetching derivation assumptions:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
