export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/dialogue-state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/deliberations/[id]/dialogue-state?argumentId=xxx
 * 
 * Returns dialogue state for an argument:
 * - totalAttacks: Number of incoming attacks (ArgumentEdges)
 * - answeredAttacks: Number of attacks with GROUNDS responses
 * - moveComplete: Boolean indicating if all attacks have been answered
 * - attacks: Detailed list of attacks with response status
 * 
 * Used by DialogueStateBadge and AnsweredAttacksPanel.
 * 
 * OPTIMIZED: Uses single query with aggregation instead of N+1 queries.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;
  const { searchParams } = new URL(req.url);
  const argumentId = searchParams.get("argumentId");

  if (!argumentId) {
    return NextResponse.json(
      { ok: false, error: "Missing argumentId parameter" },
      { status: 400, ...NO_STORE }
    );
  }

  try {
    // Single optimized query: Get all attacks with their source argument info
    const attacks = await prisma.argumentEdge.findMany({
      where: {
        toArgumentId: argumentId,
        deliberationId,
        attackType: { in: ["REBUTS", "UNDERCUTS", "UNDERMINES"] },
      },
      select: {
        id: true,
        attackType: true,
        fromArgumentId: true,
        from: {
          select: {
            id: true,
            conclusion: {
              select: { text: true }
            }
          }
        }
      },
    });

    // Get all GROUNDS moves for this argument in one query
    const groundsMoves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        targetType: "argument",
        targetId: argumentId,
        kind: "GROUNDS",
      },
      select: {
        id: true,
        createdAt: true,
        // Get the argument that was used as grounds
        targetId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Build a set of attack IDs that have been answered
    // A GROUNDS move on an argument counts as answering attacks on that argument
    const hasGroundsResponse = groundsMoves.length > 0;
    const lastResponseAt = groundsMoves[0]?.createdAt || null;

    // Build detailed attack list for AnsweredAttacksPanel
    const attackDetails = attacks.map((attack) => ({
      attackId: attack.id,
      attackerArgumentId: attack.fromArgumentId,
      attackerTitle: attack.from?.conclusion?.text?.slice(0, 60) || "Unknown",
      attackType: attack.attackType?.toLowerCase() || "rebut",
      // For now, if there's any GROUNDS response, consider attacks answered
      // More precise tracking would require linking specific responses to specific attacks
      answered: hasGroundsResponse,
      responseId: hasGroundsResponse ? groundsMoves[0]?.id : undefined,
    }));

    const totalAttacks = attacks.length;
    const answeredAttacks = hasGroundsResponse ? totalAttacks : 0;
    const moveComplete = totalAttacks > 0 && hasGroundsResponse;

    return NextResponse.json(
      {
        ok: true,
        state: {
          totalAttacks,
          answeredAttacks,
          moveComplete,
          lastResponseAt: lastResponseAt?.toISOString(),
          attacks: attackDetails,
        },
      },
      NO_STORE
    );
  } catch (err) {
    console.error("[dialogue-state] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500, ...NO_STORE }
    );
  }
}
