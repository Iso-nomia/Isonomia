export const dynamic = "force-dynamic";

// app/api/non-canonical/pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  try {
    // ─── 1. Authentication ─────────────────────────────────────
    const currentUserId = await getCurrentUserId();

    // ─── 2. Query Parameters ───────────────────────────────────
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");

    if (!deliberationId) {
      return NextResponse.json(
        { error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // ─── 3. Fetch Pending Moves (Raw Query) ───────────────────
    // Find all pending non-canonical moves where current user is the author
    const pendingMoves = await prisma.$queryRaw<
      Array<{
        id: string;
        targetType: string;
        targetId: string;
        targetMoveId: string | null;
        contributorId: string;
        moveType: string;
        content: any;
        createdAt: Date;
      }>
    >`
      SELECT
        id, "targetType", "targetId", "targetMoveId",
        "contributorId", "moveType", content, "createdAt"
      FROM "non_canonical_moves"
      WHERE "deliberationId" = ${deliberationId}
        AND "authorId" = ${currentUserId?.toString() || ""}
        AND status = 'PENDING'
      ORDER BY "createdAt" DESC
    `;

    // ─── 4. Enrich with Contributor Info ──────────────────────
    const contributorIds = [...new Set(pendingMoves.map(m => m.contributorId))];
    const contributors = await prisma.user.findMany({
      where: {
        id: { in: contributorIds.map(id => BigInt(id)) }
      },
      select: {
        id: true,
        username: true,
        image: true
      }
    });

    const contributorMap = new Map(
      contributors.map(u => [u.id.toString(), u])
    );

    const enrichedMoves = pendingMoves.map(move => ({
      ...move,
      contributor: contributorMap.get(move.contributorId) || null
    }));

    // ─── 5. Return Results ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      pendingCount: enrichedMoves.length,
      moves: enrichedMoves
    });

  } catch (error: any) {
    console.error("[non-canonical/pending] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
