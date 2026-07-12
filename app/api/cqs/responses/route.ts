export const dynamic = "force-dynamic";

// app/api/cqs/responses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCQPermissions } from "@/lib/cqs/permissions";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  
  const { searchParams } = new URL(req.url);
  const cqStatusId = searchParams.get("cqStatusId");
  const status = searchParams.get("status"); // pending|approved|canonical|all

  if (!cqStatusId) {
    return NextResponse.json({ error: "cqStatusId required" }, { status: 400 });
  }

  // Check if CQ exists
  const cqStatus = await prisma.cQStatus.findUnique({
    where: { id: cqStatusId },
    select: { id: true, targetId: true, targetType: true },
  });

  if (!cqStatus) {
    return NextResponse.json({ error: "CQ not found" }, { status: 404 });
  }

  // Get permissions (even for unauthenticated users)
  const permissions = userId
    ? await getCQPermissions(String(userId), cqStatusId)
    : {
        canViewCQ: true,
        canViewPendingResponses: false,
      };

  // Build where clause based on permissions and filters
  const where: any = { cqStatusId };

  if (status && status !== "all") {
    if (status === "pending") {
      where.responseStatus = "PENDING";
      // Only author/moderator can see pending
      if (!permissions.canViewPendingResponses) {
        return NextResponse.json(
          { error: "Forbidden: Cannot view pending responses" },
          { status: 403 }
        );
      }
    } else if (status === "approved") {
      where.responseStatus = { in: ["APPROVED", "CANONICAL"] };
    } else if (status === "canonical") {
      where.responseStatus = "CANONICAL";
    }
  } else {
    // Default: show approved + canonical (not pending unless authorized)
    where.responseStatus = permissions.canViewPendingResponses
      ? { in: ["PENDING", "APPROVED", "CANONICAL"] }
      : { in: ["APPROVED", "CANONICAL"] };
  }

  // Fetch responses with related data
  const responses = await prisma.cQResponse.findMany({
    where,
    include: {
      endorsements: {
        select: {
          id: true,
          userId: true,
          weight: true,
          comment: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { responseStatus: "desc" }, // CANONICAL first
      { upvotes: "desc" }, // Then by votes
      { createdAt: "desc" }, // Then by recency
    ],
  });

  // Hydrate with contributor info (would need User relation in real impl)
  const enriched = responses.map((r) => ({
    ...r,
    netVotes: r.upvotes - r.downvotes,
    endorsementCount: r.endorsements.length,
    // TODO: Add contributor user info
  }));

  return NextResponse.json({
    ok: true,
    responses: enriched,
    count: enriched.length,
  });
}
