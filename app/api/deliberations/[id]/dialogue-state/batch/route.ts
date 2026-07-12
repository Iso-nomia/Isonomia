export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/dialogue-state/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * POST /api/deliberations/[id]/dialogue-state/batch
 * Body: { argumentIds: string[] }
 * 
 * Returns dialogue state for multiple arguments in a single request.
 * Optimized for diagram viewers that need state for many arguments at once.
 * 
 * Returns: { ok: true, states: { [argumentId]: DialogueState } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;

  try {
    const body = await req.json();
    const { argumentIds } = body;

    if (!argumentIds || !Array.isArray(argumentIds) || argumentIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "argumentIds array is required" },
        { status: 400, ...NO_STORE }
      );
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 100;
    const limitedIds = argumentIds.slice(0, MAX_BATCH_SIZE);

    // Single query: Get all attacks targeting any of the arguments
    const allAttacks = await prisma.argumentEdge.findMany({
      where: {
        toArgumentId: { in: limitedIds },
        deliberationId,
        attackType: { in: ["REBUTS", "UNDERCUTS", "UNDERMINES"] },
      },
      select: {
        id: true,
        attackType: true,
        fromArgumentId: true,
        toArgumentId: true,
      },
    });

    // Single query: Get all GROUNDS moves for any of the arguments
    const allGroundsMoves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        targetType: "argument",
        targetId: { in: limitedIds },
        kind: "GROUNDS",
      },
      select: {
        id: true,
        createdAt: true,
        targetId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group attacks by target argument
    const attacksByArgument = new Map<string, typeof allAttacks>();
    for (const attack of allAttacks) {
      const existing = attacksByArgument.get(attack.toArgumentId) || [];
      existing.push(attack);
      attacksByArgument.set(attack.toArgumentId, existing);
    }

    // Group GROUNDS moves by target argument
    const groundsByArgument = new Map<string, typeof allGroundsMoves>();
    for (const move of allGroundsMoves) {
      if (!move.targetId) continue;
      const existing = groundsByArgument.get(move.targetId) || [];
      existing.push(move);
      groundsByArgument.set(move.targetId, existing);
    }

    // Build state for each argument
    const states: Record<string, {
      totalAttacks: number;
      answeredAttacks: number;
      moveComplete: boolean;
      lastResponseAt?: string;
    }> = {};

    for (const argumentId of limitedIds) {
      const attacks = attacksByArgument.get(argumentId) || [];
      const groundsMoves = groundsByArgument.get(argumentId) || [];
      
      const totalAttacks = attacks.length;
      const hasGroundsResponse = groundsMoves.length > 0;
      const lastResponseAt = groundsMoves[0]?.createdAt || null;
      
      const answeredAttacks = hasGroundsResponse ? totalAttacks : 0;
      const moveComplete = totalAttacks > 0 && hasGroundsResponse;

      states[argumentId] = {
        totalAttacks,
        answeredAttacks,
        moveComplete,
        lastResponseAt: lastResponseAt?.toISOString(),
      };
    }

    return NextResponse.json(
      {
        ok: true,
        states,
        count: Object.keys(states).length,
      },
      NO_STORE
    );
  } catch (err) {
    console.error("[dialogue-state/batch] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500, ...NO_STORE }
    );
  }
}
