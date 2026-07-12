export const dynamic = "force-dynamic";

// app/api/non-canonical/by-target/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  try {
    // ─── 1. Authentication (optional for viewing) ──────────────
    const currentUserId = await getCurrentUserId().catch(() => null);

    // ─── 2. Query Parameters ───────────────────────────────────
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("targetId");
    const targetType = searchParams.get("targetType");
    const includeStatus = searchParams.get("status") || "APPROVED,EXECUTED"; // default to visible states

    if (!targetId || !targetType) {
      return NextResponse.json(
        { error: "targetId and targetType are required" },
        { status: 400 }
      );
    }

    // ─── 3. Parse Status Filter ───────────────────────────────
    const statusList = includeStatus.split(",").map(s => s.trim());

    // ─── 4. Build Query ────────────────────────────────────────
    const statusPlaceholders = statusList.map(() => "?").join(",");
    
    const moves = await prisma.$queryRaw<
      Array<{
        id: string;
        targetType: string;
        targetId: string;
        contributorId: string;
        authorId: string;
        moveType: string;
        content: any;
        status: string;
        createdAt: Date;
        approvedAt: Date | null;
        canonicalMoveId: string | null;
      }>
    >`
      SELECT
        id, "targetType", "targetId", "contributorId", "authorId",
        "moveType", content, status, "createdAt", "approvedAt", "canonicalMoveId"
      FROM "non_canonical_moves"
      WHERE "targetId" = ${targetId}
        AND "targetType" = ${targetType}
        AND status = ANY(${statusList}::"NCMStatus"[])
      ORDER BY "createdAt" DESC
    `;

    // ─── 5. Enrich with User Info ─────────────────────────────
    const userIds = [
      ...new Set([
        ...moves.map(m => m.contributorId),
        ...moves.map(m => m.authorId)
      ])
    ];

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds.map(id => BigInt(id)) }
      },
      select: {
        id: true,
        username: true,
        image: true
      }
    });

    // Convert BigInt to string for JSON serialization
    const userMap = new Map(
      users.map(u => [
        u.id.toString(), 
        {
          id: u.id.toString(),
          username: u.username,
          image: u.image
        }
      ])
    );

    const enrichedMoves = moves.map(move => ({
      ...move,
      contributor: userMap.get(move.contributorId) || null,
      author: userMap.get(move.authorId) || null,
      isOwnSubmission: currentUserId?.toString() === move.contributorId,
      canApprove: currentUserId?.toString() === move.authorId && move.status === "PENDING"
    }));

    // ─── 6. Return Results ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      targetId,
      targetType,
      count: enrichedMoves.length,
      moves: enrichedMoves
    });

  } catch (error: any) {
    console.error("[non-canonical/by-target] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
