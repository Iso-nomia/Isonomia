export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/challenges-on-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/deliberations/[id]/challenges-on-user?userId=X
 * 
 * Fetch all WHY dialogue moves targeting a specific user's work.
 * Used by DiscourseDashboard "Actions on My Work" panel.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter required" },
      { status: 400, ...NO_STORE }
    );
  }

  try {
    // Find all claims authored by this user
    const userClaims = await prisma.claim.findMany({
      where: {
        deliberationId,
        createdById: userId,
      },
      select: { id: true, text: true },
    });

    // Find all arguments authored by this user
    const userArguments = await prisma.argument.findMany({
      where: {
        deliberationId,
        authorId: userId,
      },
      select: { 
        id: true, 
        text: true,
        claim: {
          select: { text: true },
        },
      },
    });

    const userClaimIds = userClaims.map((c) => c.id);
    const userArgumentIds = userArguments.map((a) => a.id);

    // Find all WHY moves targeting user's claims or arguments
    const whyMoves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        kind: "WHY",
        OR: [
          {
            targetType: "claim",
            targetId: { in: userClaimIds },
          },
          {
            targetType: "argument",
            targetId: { in: userArgumentIds },
          },
        ],
        actorId: { not: userId }, // Exclude user's own WHY moves
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch user's response moves (GROUNDS, CONCEDE, RETRACT) to check responded status
    const userResponseMoves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        actorId: userId,
        kind: { in: ["GROUNDS", "CONCEDE", "RETRACT"] },
        OR: [
          { targetType: "claim", targetId: { in: userClaimIds } },
          { targetType: "argument", targetId: { in: userArgumentIds } },
        ],
      },
      select: {
        targetType: true,
        targetId: true,
        kind: true,
        createdAt: true,
      },
    });

    // Create a map of responded targets: "claim:id" or "argument:id" -> response info
    const respondedTargets = new Map<string, { kind: string; respondedAt: Date }>();
    for (const move of userResponseMoves) {
      const key = `${move.targetType}:${move.targetId}`;
      const existing = respondedTargets.get(key);
      if (!existing || move.createdAt > existing.respondedAt) {
        respondedTargets.set(key, { kind: move.kind, respondedAt: move.createdAt });
      }
    }

    // Fetch challenger user profiles
    const challengerIds = whyMoves
      .map((m) => m.actorId)
      .filter(Boolean) as string[];
    
    const challengerUsers = await prisma.user.findMany({
      where: { id: { in: challengerIds.map(id => BigInt(id)) } },
      select: { id: true, name: true, username: true },
    });

    const challengerUserMap = new Map(
      challengerUsers.map((u) => [u.id.toString(), u])
    );

    // Format for dashboard
    const formatted = whyMoves.map((move) => {
      // Find target text
      const targetText = 
        userClaims.find((c) => c.id === move.targetId)?.text ||
        userArguments.find((a) => a.id === move.targetId)?.claim?.text ||
        "";

      // Get challenger name
      const challengerUser = move.actorId 
        ? challengerUserMap.get(move.actorId)
        : null;
      const challengerName = challengerUser?.name || challengerUser?.username || "Unknown";

      // Check if user has responded to this challenge
      const targetKey = `${move.targetType}:${move.targetId}`;
      const responseInfo = respondedTargets.get(targetKey);
      const responded = !!responseInfo;
      const responseType = responseInfo?.kind || null;
      const respondedAt = responseInfo?.respondedAt || null;

      return {
        id: move.id,
        challengerId: move.actorId,
        challengerName,
        targetType: move.targetType,
        targetId: move.targetId,
        targetText,
        payload: move.payload,
        createdAt: move.createdAt,
        responded,
        responseType,
        respondedAt,
      };
    });

    return NextResponse.json(formatted, NO_STORE);
  } catch (err) {
    console.error("[GET /api/deliberations/[id]/challenges-on-user] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500, ...NO_STORE }
    );
  }
}
