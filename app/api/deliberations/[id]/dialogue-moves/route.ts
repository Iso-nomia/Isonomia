export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/dialogue-moves/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/deliberations/[id]/dialogue-moves?actorId=X&kind=WHY
 * 
 * Fetch all dialogue moves by a specific user in a deliberation.
 * Optionally filter by move kind (WHY, GROUNDS, CONCEDE, etc.).
 * Used by DiscourseDashboard "My Engagements" panel.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;
  const actorId = req.nextUrl.searchParams.get("actorId");
  const kind = req.nextUrl.searchParams.get("kind");

  if (!actorId) {
    return NextResponse.json(
      { error: "actorId query parameter required" },
      { status: 400, ...NO_STORE }
    );
  }

  try {
    const where: any = {
      deliberationId,
      actorId,
    };

    if (kind) {
      where.kind = kind;
    }

    const moves = await prisma.dialogueMove.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        targetId: true,
        targetType: true,
        payload: true,
        createdAt: true,
      },
    });

    // Fetch target text for all moves
    const claimTargetIds = moves
      .filter(m => m.targetType === "claim" && m.targetId)
      .map(m => m.targetId!);
    const argumentTargetIds = moves
      .filter(m => m.targetType === "argument" && m.targetId)
      .map(m => m.targetId!);

    // Fetch GROUNDS arguments (Arguments created by GROUNDS moves)
    const groundsMoveIds = moves
      .filter(m => m.kind === "GROUNDS")
      .map(m => m.id);

    const [targetClaims, targetArguments, groundsArguments] = await Promise.all([
      prisma.claim.findMany({
        where: { id: { in: claimTargetIds } },
        select: { id: true, text: true },
      }),
      prisma.argument.findMany({
        where: { id: { in: argumentTargetIds } },
        select: { id: true, text: true, claim: { select: { text: true } } },
      }),
      prisma.argument.findMany({
        where: { createdByMoveId: { in: groundsMoveIds } },
        select: { id: true, text: true, createdByMoveId: true },
      }),
    ]);

    const claimMap = new Map(targetClaims.map(c => [c.id, c.text]));
    const argumentMap = new Map(targetArguments.map(a => [a.id, a.claim?.text || a.text]));
    const groundsArgumentMap = new Map(groundsArguments.map(a => [a.createdByMoveId!, a.text]));

    // Add targetText and groundsText to each move
    const movesWithTargets = moves.map(move => {
      const baseMove = {
        ...move,
        targetText: move.targetType === "claim" 
          ? claimMap.get(move.targetId!) 
          : argumentMap.get(move.targetId!),
      };

      // For GROUNDS moves, add the argument text
      if (move.kind === "GROUNDS") {
        return {
          ...baseMove,
          groundsText: groundsArgumentMap.get(move.id),
        };
      }

      return baseMove;
    });

    return NextResponse.json(movesWithTargets, NO_STORE);
  } catch (err) {
    console.error("[GET /api/deliberations/[id]/dialogue-moves] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch dialogue moves" },
      { status: 500, ...NO_STORE }
    );
  }
}
