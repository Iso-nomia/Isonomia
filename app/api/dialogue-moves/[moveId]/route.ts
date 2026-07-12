// app/api/dialogue-moves/[moveId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/dialogue-moves/[moveId]
 * 
 * Fetch full details for a specific dialogue move including:
 * - Move metadata (kind, timestamp, content)
 * - Speaker information (user name, avatar)
 * - Context (deliberation, reply-to move)
 * - Related entities (created arguments, referenced claims)
 * 
 * Used by DialogueMoveDetailModal for quick preview
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { moveId: string } }
) {
  try {
    const { moveId } = params;

    if (!moveId) {
      return NextResponse.json(
        { error: "moveId is required" },
        { status: 400, ...NO_STORE }
      );
    }

    // Fetch the dialogue move
    const move = await prisma.dialogueMove.findUnique({
      where: { id: moveId },
    });

    if (!move) {
      return NextResponse.json(
        { error: "Dialogue move not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Fetch actor/user data
    const actor = move.actorId
      ? await prisma.user.findUnique({
          where: { id: BigInt(move.actorId) },
          select: { id: true, name: true, username: true, image: true },
        })
      : null;

    // Fetch deliberation data
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: move.deliberationId },
      select: { id: true, title: true },
    });

    // Fetch reply-to move if exists
    const replyToMove = move.replyToMoveId
      ? await prisma.dialogueMove.findUnique({
          where: { id: move.replyToMoveId },
          select: { id: true, kind: true, payload: true, actorId: true },
        })
      : null;

    // Fetch reply-to actor if reply exists
    const replyToActor =
      replyToMove?.actorId
        ? await prisma.user.findUnique({
            where: { id: BigInt(replyToMove.actorId) },
            select: { name: true, username: true },
          })
        : null;

    // Fetch target claim or argument based on targetType
    let targetClaim = null;
    let targetArgument = null;
    
    if (move.targetType === "claim" && move.targetId) {
      targetClaim = await prisma.claim.findUnique({
        where: { id: move.targetId },
        select: { id: true, text: true },
      });
    } else if (move.targetType === "argument" && move.targetId) {
      targetArgument = await prisma.argument.findUnique({
        where: { id: move.targetId },
        select: { id: true, text: true },
      });
    }

    // Fetch created arguments
    const createdArguments = await prisma.argument.findMany({
      where: { createdByMoveId: moveId } as any, // Cast workaround for Prisma cache
      select: { id: true, text: true, createdAt: true },
      take: 5,
    });

    // Extract content from payload (if it's a JSON object)
    const payload = move.payload as any;
    const content = payload?.content || payload?.text || null;

    // Format the response
    const response = {
      id: move.id,
      kind: move.kind,
      content,
      createdAt: move.createdAt.toISOString(),
      deliberationId: move.deliberationId,
      
      // Speaker info
      actor: actor
        ? {
            id: String(actor.id),
            displayName: actor.name || actor.username || "Unknown User",
            name: actor.name,
            username: actor.username,
            image: actor.image,
          }
        : null,
      
      // Context
      deliberation: deliberation
        ? {
            id: deliberation.id,
            title: resolveDeliberationName(deliberation, { fallback: "Untitled Deliberation" }),
          }
        : null,
      
      replyTo: replyToMove
        ? {
            id: replyToMove.id,
            kind: replyToMove.kind,
            content: (replyToMove.payload as any)?.content || null,
            speakerName: replyToActor?.name || replyToActor?.username || "Unknown",
          }
        : null,
      
      // Targets
      targetClaim: targetClaim || null,
      targetArgument: targetArgument || null,
      
      // Results (what this move created)
      createdArguments: createdArguments.map((arg) => ({
        id: arg.id,
        text: arg.text,
        createdAt: arg.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(response, NO_STORE);
  } catch (error) {
    console.error("Error fetching dialogue move:", error);
    return NextResponse.json(
      { error: "Failed to fetch dialogue move" },
      { status: 500, ...NO_STORE }
    );
  }
}
