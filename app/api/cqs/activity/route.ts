export const dynamic = "force-dynamic";

// app/api/cqs/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cqStatusId = searchParams.get("cqStatusId");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!cqStatusId) {
    return NextResponse.json({ error: "cqStatusId required" }, { status: 400 });
  }

  // Check if CQ exists
  const cqStatus = await prisma.cQStatus.findUnique({
    where: { id: cqStatusId },
    select: { id: true },
  });

  if (!cqStatus) {
    return NextResponse.json({ error: "CQ not found" }, { status: 404 });
  }

  // Fetch activity log
  const [activities, total] = await Promise.all([
    prisma.cQActivityLog.findMany({
      where: { cqStatusId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
      select: {
        id: true,
        action: true,
        actorId: true,
        responseId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.cQActivityLog.count({
      where: { cqStatusId },
    }),
  ]);

  // TODO: Hydrate with actor user info
  // For now, return raw data
  const enriched = activities.map((a) => ({
    ...a,
    // Would add: actor: { id, name, image }
  }));

  return NextResponse.json({
    ok: true,
    activities: enriched,
    total,
    limit,
    offset,
    hasMore: offset + activities.length < total,
  });
}
