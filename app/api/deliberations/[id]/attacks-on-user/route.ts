export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/attacks-on-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/deliberations/[id]/attacks-on-user?userId=X
 * 
 * Fetch all attacks (ConflictApplications) targeting a specific user's work.
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
    // Find all claims authored by this user in this deliberation
    const userClaims = await prisma.claim.findMany({
      where: {
        deliberationId,
        createdById: userId,
      },
      select: { id: true },
    });

    // Find all arguments authored by this user in this deliberation
    const userArguments = await prisma.argument.findMany({
      where: {
        deliberationId,
        authorId: userId,
      },
      select: { id: true },
    });

    const userClaimIds = userClaims.map((c) => c.id);
    const userArgumentIds = userArguments.map((a) => a.id);

    // Find all ConflictApplications targeting user's claims or arguments
    const attacks = await prisma.conflictApplication.findMany({
      where: {
        deliberationId,
        OR: [
          { conflictedClaimId: { in: userClaimIds } },
          { conflictedArgumentId: { in: userArgumentIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch user's response moves (GROUNDS, CONCEDE, RETRACT) to check responded status
    // A user has "responded" to an attack if they've made a dialogue move targeting
    // the same claim/argument that was attacked
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
      // Keep the most recent response
      const existing = respondedTargets.get(key);
      if (!existing || move.createdAt > existing.respondedAt) {
        respondedTargets.set(key, { kind: move.kind, respondedAt: move.createdAt });
      }
    }

    // Collect all unique claim/argument IDs we need to fetch
    const conflictingClaimIds = attacks
      .map((a: any) => a.conflictingClaimId)
      .filter(Boolean) as string[];
    const conflictingArgumentIds = attacks
      .map((a: any) => a.conflictingArgumentId)
      .filter(Boolean) as string[];
    const conflictedClaimIds = attacks
      .map((a: any) => a.conflictedClaimId)
      .filter(Boolean) as string[];
    const conflictedArgumentIds = attacks
      .map((a: any) => a.conflictedArgumentId)
      .filter(Boolean) as string[];

    // Fetch all related claims and arguments in bulk
    const [conflictingClaims, conflictingArguments, conflictedClaims, conflictedArguments] = await Promise.all([
      prisma.claim.findMany({
        where: { id: { in: conflictingClaimIds } },
        select: { id: true, text: true, createdById: true },
      }),
      prisma.argument.findMany({
        where: { id: { in: conflictingArgumentIds } },
        select: {
          id: true,
          text: true,
          authorId: true,
          claim: { select: { text: true } },
        },
      }),
      prisma.claim.findMany({
        where: { id: { in: conflictedClaimIds } },
        select: { id: true, text: true },
      }),
      prisma.argument.findMany({
        where: { id: { in: conflictedArgumentIds } },
        select: {
          id: true,
          text: true,
          claim: { select: { text: true } },
        },
      }),
    ]);

    // Collect unique attacker user IDs
    const attackerUserIds = [
      ...conflictingClaims.map(c => c.createdById),
      ...conflictingArguments.map(a => a.authorId),
    ].filter(Boolean) as string[];

    console.log("[attacks-on-user] Attacker user IDs:", attackerUserIds);

    // Fetch attacker user profiles
    // Note: createdById/authorId store the User.id (BigInt), not auth_id
    const attackerUsers = await prisma.user.findMany({
      where: { id: { in: attackerUserIds.map(id => BigInt(id)) } },
      select: { id: true, name: true, username: true },
    });

    console.log("[attacks-on-user] Found attacker users:", attackerUsers.length);

    const attackerUserMap = new Map(attackerUsers.map((u) => [u.id.toString(), u]));

    // Create lookup maps
    const conflictingClaimMap = new Map(conflictingClaims.map((c) => [c.id, c]));
    const conflictingArgumentMap = new Map(conflictingArguments.map((a) => [a.id, a]));
    const conflictedClaimMap = new Map(conflictedClaims.map((c) => [c.id, c]));
    const conflictedArgumentMap = new Map(conflictedArguments.map((a) => [a.id, a]));

    // Format for dashboard
    const formatted = attacks.map((attack: any) => {
      // Determine attacker
      const conflictingClaim = attack.conflictingClaimId
        ? conflictingClaimMap.get(attack.conflictingClaimId)
        : null;
      const conflictingArgument = attack.conflictingArgumentId
        ? conflictingArgumentMap.get(attack.conflictingArgumentId)
        : null;

      const attackerId = conflictingClaim?.createdById || 
                        conflictingArgument?.authorId || 
                        null;

      // Fetch attacker name
      const attackerUser = attackerId ? attackerUserMap.get(attackerId) : null;
      const attackerName = attackerUser?.name || attackerUser?.username || "Unknown";

      if (!attackerUser && attackerId) {
        console.log("[attacks-on-user] No user found for attackerId:", attackerId);
      }

      // Determine target
      const conflictedClaim = attack.conflictedClaimId
        ? conflictedClaimMap.get(attack.conflictedClaimId)
        : null;
      const conflictedArgument = attack.conflictedArgumentId
        ? conflictedArgumentMap.get(attack.conflictedArgumentId)
        : null;

      const targetType = attack.conflictedClaimId ? "claim" : "argument";
      const targetId = attack.conflictedClaimId || attack.conflictedArgumentId || "";
      const targetText = conflictedClaim?.text || 
                         conflictedArgument?.claim?.text || 
                         "";

      // Check if user has responded to this attack target
      const targetKey = `${targetType}:${targetId}`;
      const responseInfo = respondedTargets.get(targetKey);
      const responded = !!responseInfo;
      const responseType = responseInfo?.kind || null;
      const respondedAt = responseInfo?.respondedAt || null;

      return {
        id: attack.id,
        attackerId,
        attackerName,
        legacyAttackType: attack.legacyAttackType,
        legacyTargetScope: attack.legacyTargetScope,
        targetType,
        targetId,
        targetText,
        createdAt: attack.createdAt,
        responded,
        responseType,
        respondedAt,
      };
    });

    return NextResponse.json(formatted, NO_STORE);
  } catch (err) {
    console.error("[GET /api/deliberations/[id]/attacks-on-user] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch attacks" },
      { status: 500, ...NO_STORE }
    );
  }
}
