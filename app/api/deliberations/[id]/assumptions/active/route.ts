export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/assumptions/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/deliberations/[id]/assumptions/active
 * Retrieve active (ACCEPTED) assumptions for a deliberation.
 * 
 * Query params:
 * - argumentId: Filter by specific argument
 * - role: Filter by role (premise, warrant, value, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const argumentId = searchParams.get("argumentId");
    const role = searchParams.get("role");

    // Build where clause
    const where: any = {
      deliberationId,
      status: "ACCEPTED",
    };

    if (argumentId) {
      where.argumentId = argumentId;
    }

    if (role) {
      where.role = role;
    }

    // Fetch active assumptions with related data
    const assumptions = await prisma.assumptionUse.findMany({
      where,
      orderBy: {
        statusChangedAt: "desc",
      },
    });

    // Enrich with argument and claim data
    const enriched = await Promise.all(
      assumptions.map(async (assumption) => {
        const [argument, claim] = await Promise.all([
          assumption.argumentId
            ? prisma.argument.findUnique({
                where: { id: assumption.argumentId },
                select: {
                  id: true,
                  text: true,
                  conclusionClaimId: true,
                },
              })
            : null,
          assumption.assumptionClaimId
            ? prisma.claim.findUnique({
                where: { id: assumption.assumptionClaimId },
                select: {
                  id: true,
                  text: true,
                },
              })
            : null,
        ]);

        return {
          ...assumption,
          argument,
          claim,
        };
      })
    );

    return NextResponse.json(
      {
        deliberationId,
        count: enriched.length,
        assumptions: enriched,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching active assumptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch assumptions" },
      { status: 500 }
    );
  }
}
