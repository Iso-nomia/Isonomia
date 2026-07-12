export const dynamic = "force-dynamic";

/**
 * DDS Position Validation API
 * POST /api/ludics/dds/positions/validate
 * 
 * Validates if a position is legal according to ludics rules.
 * Based on Faggian & Hyland (2002) - Definition 3.7
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  validateLegality,
  createPosition,
  type Position,
  type Action,
  type LegalityOptions,
} from "@/packages/ludics-core/dds";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { position, sequence, player, disputeId, options } = body as {
      position?: Position;
      sequence?: Action[];
      player?: "P" | "O";
      disputeId?: string;
      options?: LegalityOptions;
    };

    let positionToValidate: Position;

    // Option 1: Use provided position object
    if (position) {
      positionToValidate = position;
    }
    // Option 2: Create position from sequence
    else if (sequence && player) {
      const result = createPosition(
        `pos-${Date.now()}`,
        sequence,
        player,
        disputeId,
        options || {}
      );
      positionToValidate = result;
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "Either position object or (sequence + player) is required",
        },
        { status: 400 }
      );
    }

    // Validate legality
    const check = validateLegality(positionToValidate, options || {});

    const isLegal =
      check.isLinear &&
      check.isParity &&
      check.isJustified &&
      check.isVisible;

    // Store position if legal (or always store if disputeId provided)
    let savedPosition = null;
    if (disputeId || isLegal) {
      savedPosition = await prisma.ludicPosition.create({
        data: {
          disputeId: disputeId || null,
          sequence: positionToValidate.sequence as any,
          isLinear: check.isLinear,
          isParity: check.isParity,
          isJustified: check.isJustified,
          isVisible: check.isVisible,
          isLegal,
          player: positionToValidate.player,
          validationLog: check as any,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      isLegal,
      check,
      position: savedPosition,
    });
  } catch (error: any) {
    console.error("Position validation error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/dds/positions/validate
 * Fetch existing validated positions
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const disputeId = url.searchParams.get("disputeId");
    const onlyLegal = url.searchParams.get("onlyLegal") === "true";

    if (!disputeId) {
      return NextResponse.json(
        { ok: false, error: "disputeId is required" },
        { status: 400 }
      );
    }

    const where: any = { disputeId };
    if (onlyLegal) where.isLegal = true;

    const positions = await prisma.ludicPosition.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      positions,
      count: positions.length,
    });
  } catch (error: any) {
    console.error("Position fetch error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
