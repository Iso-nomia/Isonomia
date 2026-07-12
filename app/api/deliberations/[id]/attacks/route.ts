export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/attacks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET /api/deliberations/[id]/attacks?attackerId=X
 * 
 * Fetch all attacks (ConflictApplications) created by a specific user.
 * Used by DiscourseDashboard "My Engagements" panel.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;
  const attackerId = req.nextUrl.searchParams.get("attackerId");

  if (!attackerId) {
    return NextResponse.json(
      { error: "attackerId query parameter required" },
      { status: 400, ...NO_STORE }
    );
  }

  try {
    // Find all ConflictApplications where user is the attacker
    // (either via conflictingClaim or conflictingArgument)
    
    // First get user's claims and arguments
    const [userClaims, userArguments] = await Promise.all([
      prisma.claim.findMany({
        where: {
          deliberationId,
          createdById: attackerId,
        },
        select: { id: true },
      }),
      prisma.argument.findMany({
        where: {
          deliberationId,
          authorId: attackerId,
        },
        select: { id: true },
      }),
    ]);

    const userClaimIds = userClaims.map((c) => c.id);
    const userArgumentIds = userArguments.map((a) => a.id);

    // Find attacks where user's claims/arguments are the conflicting elements
    const attacks = await prisma.conflictApplication.findMany({
      where: {
        deliberationId,
        OR: [
          { conflictingClaimId: { in: userClaimIds } },
          { conflictingArgumentId: { in: userArgumentIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch target claims and arguments for display
    const conflictedClaimIds = attacks
      .map((a: any) => a.conflictedClaimId)
      .filter(Boolean) as string[];
    const conflictedArgumentIds = attacks
      .map((a: any) => a.conflictedArgumentId)
      .filter(Boolean) as string[];

    const [conflictedClaims, conflictedArguments] = await Promise.all([
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

    const claimMap = new Map(conflictedClaims.map((c) => [c.id, c]));
    const argumentMap = new Map(conflictedArguments.map((a) => [a.id, a]));

    // Collect unique attacker user IDs (from conflicting claims/arguments)
    const conflictingClaimIds = attacks
      .map((a: any) => a.conflictingClaimId)
      .filter(Boolean) as string[];
    const conflictingArgumentIds = attacks
      .map((a: any) => a.conflictingArgumentId)
      .filter(Boolean) as string[];

    // We already have conflictedClaims and conflictedArguments, but we need the conflicting ones for attacker names
    const [conflictingClaims, conflictingArguments] = await Promise.all([
      prisma.claim.findMany({
        where: { id: { in: conflictingClaimIds } },
        select: { id: true, createdById: true },
      }),
      prisma.argument.findMany({
        where: { id: { in: conflictingArgumentIds } },
        select: { id: true, authorId: true },
      }),
    ]);

    // Since we're fetching attacks by attackerId (user's own attacks), the attacker is always the user
    // But let's still fetch the user profile for consistency
    // Note: attackerId is the User.id (BigInt), not auth_id
    const attackerProfile = await prisma.user.findUnique({
      where: { id: BigInt(attackerId) },
      select: { name: true, username: true },
    });

    const attackerName = attackerProfile?.name || attackerProfile?.username || "You";

    // Format with target information
    const formatted = attacks.map((attack: any) => {
      const targetClaim = attack.conflictedClaimId
        ? claimMap.get(attack.conflictedClaimId)
        : null;
      const targetArgument = attack.conflictedArgumentId
        ? argumentMap.get(attack.conflictedArgumentId)
        : null;

      return {
        ...attack,
        attackerName,
        targetText: targetClaim?.text || targetArgument?.claim?.text || targetArgument?.text || "Unknown target",
        targetType: attack.conflictedClaimId ? "claim" : "argument",
      };
    });

    return NextResponse.json(formatted, NO_STORE);
  } catch (err) {
    console.error("[GET /api/deliberations/[id]/attacks] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch attacks" },
      { status: 500, ...NO_STORE }
    );
  }
}
