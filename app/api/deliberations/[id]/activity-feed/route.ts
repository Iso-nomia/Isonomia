export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/activity-feed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

// Activity types for the feed
type ActivityType = 
  | "attack_received"
  | "attack_created"
  | "challenge_received"
  | "challenge_created"
  | "response_received"
  | "response_created"
  | "claim_created"
  | "argument_created";

interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  targetType?: string;
  targetId?: string;
  targetText?: string;
  actorId?: string;
  actorName?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * GET /api/deliberations/[id]/activity-feed?userId=X&limit=50
 * 
 * Fetch recent activity stream for a user in a deliberation.
 * Aggregates from multiple sources:
 * - Attacks on user's work
 * - Challenges on user's work
 * - Responses to user's attacks/challenges
 * - User's own contributions
 * 
 * Used by DiscourseDashboard "Activity Feed" panel.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;
  const userId = req.nextUrl.searchParams.get("userId");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter required" },
      { status: 400, ...NO_STORE }
    );
  }

  try {
    // Get user's claims and arguments for context
    const [userClaims, userArguments] = await Promise.all([
      prisma.claim.findMany({
        where: { deliberationId, createdById: userId },
        select: { id: true, text: true },
      }),
      prisma.argument.findMany({
        where: { deliberationId, authorId: userId },
        select: { id: true, text: true, claim: { select: { text: true } } },
      }),
    ]);

    const userClaimIds = userClaims.map((c) => c.id);
    const userArgumentIds = userArguments.map((a) => a.id);

    // Fetch activities from multiple sources in parallel
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const [
      attacksOnUser,
      attacksByUser,
      challengesOnUser,
      challengesByUser,
      responsesToUser,
      responsesByUser,
      recentUserClaims,
      recentUserArguments,
    ] = await Promise.all([
      // Attacks on user's work
      prisma.conflictApplication.findMany({
        where: {
          deliberationId,
          createdAt: { gte: oneMonthAgo },
          OR: [
            { conflictedClaimId: { in: userClaimIds } },
            { conflictedArgumentId: { in: userArgumentIds } },
          ],
        },
        include: {
          conflictedClaim: { select: { text: true } },
          conflictedArgument: { select: { text: true, claim: { select: { text: true } } } },
          conflictingClaim: { select: { text: true, createdById: true } },
          conflictingArgument: { select: { text: true, authorId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // Attacks created by user
      prisma.conflictApplication.findMany({
        where: {
          deliberationId,
          createdAt: { gte: oneMonthAgo },
          OR: [
            { conflictingClaim: { createdById: userId } },
            { conflictingArgument: { authorId: userId } },
          ],
        },
        include: {
          conflictedClaim: { select: { text: true } },
          conflictedArgument: { select: { text: true, claim: { select: { text: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // WHY challenges on user's work
      prisma.dialogueMove.findMany({
        where: {
          deliberationId,
          kind: "WHY",
          createdAt: { gte: oneMonthAgo },
          actorId: { not: userId },
          OR: [
            { targetType: "claim", targetId: { in: userClaimIds } },
            { targetType: "argument", targetId: { in: userArgumentIds } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // WHY challenges created by user
      prisma.dialogueMove.findMany({
        where: {
          deliberationId,
          kind: "WHY",
          actorId: userId,
          createdAt: { gte: oneMonthAgo },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // Responses to user's WHY challenges (GROUNDS/CONCEDE/RETRACT by others)
      prisma.dialogueMove.findMany({
        where: {
          deliberationId,
          kind: { in: ["GROUNDS", "CONCEDE", "RETRACT"] },
          actorId: { not: userId },
          createdAt: { gte: oneMonthAgo },
          // Find responses to things user challenged
          OR: [
            { targetType: "claim", targetId: { in: userClaimIds } },
            { targetType: "argument", targetId: { in: userArgumentIds } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // Responses created by user
      prisma.dialogueMove.findMany({
        where: {
          deliberationId,
          kind: { in: ["GROUNDS", "CONCEDE", "RETRACT"] },
          actorId: userId,
          createdAt: { gte: oneMonthAgo },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // Recent claims by user
      prisma.claim.findMany({
        where: {
          deliberationId,
          createdById: userId,
          createdAt: { gte: oneMonthAgo },
        },
        select: { id: true, text: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // Recent arguments by user
      prisma.argument.findMany({
        where: {
          deliberationId,
          authorId: userId,
          createdAt: { gte: oneMonthAgo },
        },
        select: { 
          id: true, 
          text: true, 
          createdAt: true,
          claim: { select: { text: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    // Collect all actor IDs for name resolution
    const actorIds = new Set<string>();
    attacksOnUser.forEach((a) => {
      if (a.conflictingClaim?.createdById) actorIds.add(a.conflictingClaim.createdById);
      if (a.conflictingArgument?.authorId) actorIds.add(a.conflictingArgument.authorId);
    });
    challengesOnUser.forEach((m) => { if (m.actorId) actorIds.add(m.actorId); });
    responsesToUser.forEach((m) => { if (m.actorId) actorIds.add(m.actorId); });

    // Fetch user names
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(actorIds).map(id => BigInt(id)) } },
      select: { id: true, name: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id.toString(), u.name || u.username || "Someone"]));

    // Build activity items
    const activities: ActivityItem[] = [];

    // Attacks on user
    for (const attack of attacksOnUser) {
      const actorId = attack.conflictingClaim?.createdById || attack.conflictingArgument?.authorId;
      const targetText = attack.conflictedClaim?.text || 
                         attack.conflictedArgument?.claim?.text || 
                         attack.conflictedArgument?.text || "";
      activities.push({
        id: `attack_received_${attack.id}`,
        type: "attack_received",
        description: `${userMap.get(actorId || "") || "Someone"} created a ${attack.legacyAttackType || "REBUT"} attack on your ${attack.conflictedClaimId ? "claim" : "argument"}`,
        targetType: attack.conflictedClaimId ? "claim" : "argument",
        targetId: attack.conflictedClaimId || attack.conflictedArgumentId || undefined,
        targetText: targetText.slice(0, 100) + (targetText.length > 100 ? "..." : ""),
        actorId: actorId || undefined,
        actorName: userMap.get(actorId || "") || "Someone",
        createdAt: attack.createdAt,
        metadata: { attackType: attack.legacyAttackType },
      });
    }

    // Attacks by user
    for (const attack of attacksByUser) {
      const targetText = attack.conflictedClaim?.text || 
                         attack.conflictedArgument?.claim?.text || 
                         attack.conflictedArgument?.text || "";
      activities.push({
        id: `attack_created_${attack.id}`,
        type: "attack_created",
        description: `You created a ${attack.legacyAttackType || "REBUT"} attack`,
        targetType: attack.conflictedClaimId ? "claim" : "argument",
        targetId: attack.conflictedClaimId || attack.conflictedArgumentId || undefined,
        targetText: targetText.slice(0, 100) + (targetText.length > 100 ? "..." : ""),
        createdAt: attack.createdAt,
        metadata: { attackType: attack.legacyAttackType },
      });
    }

    // Challenges on user
    for (const move of challengesOnUser) {
      const targetText = userClaims.find((c) => c.id === move.targetId)?.text ||
                         userArguments.find((a) => a.id === move.targetId)?.claim?.text || "";
      activities.push({
        id: `challenge_received_${move.id}`,
        type: "challenge_received",
        description: `${userMap.get(move.actorId || "") || "Someone"} asked WHY about your ${move.targetType}`,
        targetType: move.targetType || undefined,
        targetId: move.targetId || undefined,
        targetText: targetText.slice(0, 100) + (targetText.length > 100 ? "..." : ""),
        actorId: move.actorId || undefined,
        actorName: userMap.get(move.actorId || "") || "Someone",
        createdAt: move.createdAt,
      });
    }

    // Challenges by user
    for (const move of challengesByUser) {
      activities.push({
        id: `challenge_created_${move.id}`,
        type: "challenge_created",
        description: `You asked WHY about a ${move.targetType}`,
        targetType: move.targetType || undefined,
        targetId: move.targetId || undefined,
        createdAt: move.createdAt,
      });
    }

    // Responses to user
    for (const move of responsesToUser) {
      const targetText = userClaims.find((c) => c.id === move.targetId)?.text ||
                         userArguments.find((a) => a.id === move.targetId)?.claim?.text || "";
      activities.push({
        id: `response_received_${move.id}`,
        type: "response_received",
        description: `${userMap.get(move.actorId || "") || "Someone"} responded with ${move.kind} to your ${move.targetType}`,
        targetType: move.targetType || undefined,
        targetId: move.targetId || undefined,
        targetText: targetText.slice(0, 100) + (targetText.length > 100 ? "..." : ""),
        actorId: move.actorId || undefined,
        actorName: userMap.get(move.actorId || "") || "Someone",
        createdAt: move.createdAt,
        metadata: { responseKind: move.kind },
      });
    }

    // Responses by user
    for (const move of responsesByUser) {
      activities.push({
        id: `response_created_${move.id}`,
        type: "response_created",
        description: `You responded with ${move.kind}`,
        targetType: move.targetType || undefined,
        targetId: move.targetId || undefined,
        createdAt: move.createdAt,
        metadata: { responseKind: move.kind },
      });
    }

    // Recent claims by user
    for (const claim of recentUserClaims) {
      activities.push({
        id: `claim_created_${claim.id}`,
        type: "claim_created",
        description: "You created a new claim",
        targetType: "claim",
        targetId: claim.id,
        targetText: claim.text.slice(0, 100) + (claim.text.length > 100 ? "..." : ""),
        createdAt: claim.createdAt,
      });
    }

    // Recent arguments by user
    for (const arg of recentUserArguments) {
      const text = arg.claim?.text || arg.text || "";
      activities.push({
        id: `argument_created_${arg.id}`,
        type: "argument_created",
        description: "You created a new argument",
        targetType: "argument",
        targetId: arg.id,
        targetText: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
        createdAt: arg.createdAt,
      });
    }

    // Sort all activities by date (newest first) and limit
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json(limitedActivities, NO_STORE);
  } catch (err) {
    console.error("[GET /api/deliberations/[id]/activity-feed] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch activity feed" },
      { status: 500, ...NO_STORE }
    );
  }
}
