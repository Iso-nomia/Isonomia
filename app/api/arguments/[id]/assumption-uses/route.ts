export const dynamic = "force-dynamic";

// app/api/arguments/[id]/assumption-uses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/arguments/[id]/assumption-uses
 * 
 * Fetch all AssumptionUse records for an argument.
 * Phase 3 Quick Win: Display AssumptionUse on ArgumentCard.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const argumentId = params.id;

  const assumptions = await prisma.assumptionUse.findMany({
    where: {
      argumentId,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch claim texts for claim-based assumptions
  const claimIds = assumptions
    .map((a) => a.assumptionClaimId)
    .filter((id): id is string => id !== null);

  const claims = claimIds.length
    ? await prisma.claim.findMany({
        where: { id: { in: claimIds } },
        select: { id: true, text: true },
      })
    : [];

  const claimTextById = new Map(claims.map((c) => [c.id, c.text ?? ""]));

  // Enrich assumptions with claim text
  const enriched = assumptions.map((a) => ({
    id: a.id,
    text: a.assumptionClaimId
      ? claimTextById.get(a.assumptionClaimId) ?? a.assumptionText ?? ""
      : a.assumptionText ?? "",
    role: a.role,
    weight: a.weight ?? undefined,
    confidence: a.confidence ?? undefined,
  }));

  return NextResponse.json({ assumptions: enriched }, NO_STORE);
}
