export const dynamic = "force-dynamic";

/**
 * GET /api/arguments/[id]/defeats?deliberationId=xxx
 * 
 * Get defeats on and by a specific argument
 * Returns both:
 * - Defeats ON this argument (arguments that defeat this one)
 * - Defeats BY this argument (arguments this one defeats)
 * 
 * Useful for UI tooltips and preference visualization
 */

import { NextRequest, NextResponse } from "next/server";
import { getArgumentDefeats, getPendingAttacks } from "@/lib/aspic/deliberationEvaluation";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;
    const url = new URL(req.url);
    const deliberationId = url.searchParams.get("deliberationId");

    if (!deliberationId) {
      return NextResponse.json(
        { error: "deliberationId query parameter required" },
        { status: 400, ...NO_STORE }
      );
    }

    // Verify argument exists and belongs to deliberation
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { id: true, deliberationId: true, conclusionClaimId: true },
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (argument.deliberationId !== deliberationId) {
      return NextResponse.json(
        { error: "Argument does not belong to specified deliberation" },
        { status: 400, ...NO_STORE }
      );
    }

    // Real defeat computation (Phase 2.1): build the deliberation theory with
    // stored preferences and extract defeats + preference-aware grounded
    // standing (Phase 3) for this argument.
    const { defeatsBy, defeatedBy, standing } = await getArgumentDefeats(deliberationId, argumentId);

    // Accurate preference counts straight from PA rows (cheap, no theory needed).
    // `pending` = un-ratified (PROPOSED) attacks targeting this argument — excluded
    // from the grounded extension above (DEV_SPEC §4) but surfaced as a provisional
    // "contested · pending k/N" label by the UI (§7.1).
    const [preferred, dispreferred, pending] = await Promise.all([
      prisma.preferenceApplication.count({ where: { deliberationId, preferredArgumentId: argumentId } }),
      prisma.preferenceApplication.count({ where: { deliberationId, dispreferredArgumentId: argumentId } }),
      getPendingAttacks(deliberationId, argumentId, argument.conclusionClaimId),
    ]);

    return NextResponse.json(
      {
        ok: true,
        argumentId,
        deliberationId,
        defeatsBy,   // arguments THIS argument defeats
        defeatedBy,  // arguments that defeat THIS argument
        standing,    // Phase 3: preference-aware grounded standing { status, preferenceApplied }
        pending,     // §7.1: { count, threshold, topSignoffs } of un-ratified attacks on this argument
        preferenceStats: { preferred, dispreferred },
      },
      NO_STORE
    );
  } catch (error) {
    console.error("Error fetching argument defeats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch argument defeats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, ...NO_STORE }
    );
  }
}
