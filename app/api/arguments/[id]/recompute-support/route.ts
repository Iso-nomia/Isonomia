export const dynamic = "force-dynamic";

/**
 * POST /api/arguments/[id]/recompute-support
 * 
 * Manual endpoint to recompute ArgumentSupport strength for a single argument.
 * Useful after premise/assumption changes or for testing.
 * 
 * Phase 3: Strength Recomputation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { recomputeArgumentStrength } from "@/lib/evidential/recompute-strength";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    // 1. Check if argument exists
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      include: {
        premises: true,
      },
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404 }
      );
    }

    // 2. Check if ArgumentSupport exists
    const support = await prisma.argumentSupport.findFirst({
      where: { argumentId },
    });

    if (!support) {
      return NextResponse.json(
        { error: "ArgumentSupport not found for this argument" },
        { status: 404 }
      );
    }

    // 3. Store old strength for comparison
    const oldStrength = support.strength;
    const oldRationale = support.rationale;

    // 4. Recompute strength
    const result = await recomputeArgumentStrength(argumentId);

    // 5. Update in database
    const updated = await prisma.argumentSupport.update({
      where: { id: support.id },
      data: {
        strength: result.newStrength,
        rationale: `Recomputed: base=${result.baseStrength.toFixed(2)} × premises(${result.premiseCount})=${result.premiseFactor.toFixed(2)} × assumptions(${result.assumptionCount})=${result.assumptionFactor.toFixed(2)}`,
        updatedAt: new Date(),
      },
    });

    // 6. Return detailed result
    return NextResponse.json({
      success: true,
      argumentId,
      support: {
        id: updated.id,
        strength: updated.strength,
        rationale: updated.rationale,
        composed: updated.composed,
      },
      computation: {
        baseStrength: result.baseStrength,
        premiseCount: result.premiseCount,
        premiseFactor: result.premiseFactor,
        assumptionCount: result.assumptionCount,
        assumptionFactor: result.assumptionFactor,
        newStrength: result.newStrength,
      },
      changes: {
        oldStrength,
        newStrength: result.newStrength,
        delta: result.newStrength - oldStrength,
        percentChange: ((result.newStrength - oldStrength) / oldStrength) * 100,
        oldRationale,
      },
    });
  } catch (error: any) {
    console.error("Error recomputing argument support:", error);
    return NextResponse.json(
      { 
        error: "Failed to recompute argument support",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
