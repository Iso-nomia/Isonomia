export const dynamic = "force-dynamic";

// app/api/clarification/list/route.ts
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
    const deliberationId = searchParams.get("deliberationId");
    const status = searchParams.get("status") || "OPEN,ANSWERED"; // default to active states

    if (!targetId && !deliberationId) {
      return NextResponse.json(
        { error: "Either targetId or deliberationId is required" },
        { status: 400 }
      );
    }

    // ─── 3. Parse Status Filter ───────────────────────────────
    const statusList = status.split(",").map(s => s.trim());

    // ─── 4. Build Query ────────────────────────────────────────
    let clarifications: Array<{
      id: string;
      deliberationId: string;
      targetType: string;
      targetId: string;
      askerId: string;
      question: string;
      status: string;
      answer: string | null;
      answeredBy: string | null;
      answeredAt: Date | null;
      createdAt: Date;
    }> = [];

    if (targetId && targetType) {
      // Query by specific target
      clarifications = await prisma.$queryRaw`
        SELECT
          id, "deliberationId", "targetType", "targetId", "askerId",
          question, status, answer, "answeredBy", "answeredAt", "createdAt"
        FROM "clarification_requests"
        WHERE "targetId" = ${targetId}
          AND "targetType" = ${targetType}
          AND status = ANY(${statusList}::"ClarificationStatus"[])
        ORDER BY "createdAt" DESC
      `;
    } else if (deliberationId) {
      // Query by deliberation
      clarifications = await prisma.$queryRaw`
        SELECT
          id, "deliberationId", "targetType", "targetId", "askerId",
          question, status, answer, "answeredBy", "answeredAt", "createdAt"
        FROM "clarification_requests"
        WHERE "deliberationId" = ${deliberationId}
          AND status = ANY(${statusList}::"ClarificationStatus"[])
        ORDER BY "createdAt" DESC
      `;
    }

    // ─── 5. Enrich with User Info ─────────────────────────────
    const userIds = [
      ...new Set([
        ...clarifications.map(c => c.askerId),
        ...clarifications.filter(c => c.answeredBy).map(c => c.answeredBy!)
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

    const userMap = new Map(users.map(u => [u.id.toString(), u]));

    const enriched = clarifications.map(cr => ({
      ...cr,
      asker: userMap.get(cr.askerId) || null,
      answeredByUser: cr.answeredBy ? userMap.get(cr.answeredBy) : null,
      isOwnRequest: currentUserId?.toString() === cr.askerId
    }));

    // ─── 6. Group by Target (if deliberation query) ───────────
    const grouped = deliberationId
      ? enriched.reduce((acc, cr) => {
          const key = `${cr.targetType}:${cr.targetId}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(cr);
          return acc;
        }, {} as Record<string, typeof enriched>)
      : null;

    // ─── 7. Return Results ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      count: enriched.length,
      clarifications: enriched,
      ...(grouped && { groupedByTarget: grouped })
    });

  } catch (error: any) {
    console.error("[clarification/list] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
