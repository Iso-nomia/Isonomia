export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/issues/[issueId]/reject-ncm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { asUserIdString } from "@/lib/auth/normalize";
import { emitBus } from "@/lib/server/bus";

const RejectBody = z.object({
  reviewNotes: z.string().min(1).max(2000),
});

/**
 * POST /api/deliberations/[id]/issues/[issueId]/reject-ncm
 * Reject a non-canonical move with feedback
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; issueId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deliberationId = params.id;
  const issueId = params.issueId;
  const uid = asUserIdString(userId);

  // Validate request body
  let body;
  try {
    body = RejectBody.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: "Invalid request body", details: err.errors },
      { status: 400 }
    );
  }

  // Fetch the issue with linked NCM
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      nonCanonicalMove: true,
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (issue.deliberationId !== deliberationId) {
    return NextResponse.json(
      { error: "Issue does not belong to this deliberation" },
      { status: 400 }
    );
  }

  if (issue.kind !== "community_defense") {
    return NextResponse.json(
      { error: "This endpoint is only for community defense reviews" },
      { status: 400 }
    );
  }

  if (!issue.nonCanonicalMove) {
    return NextResponse.json(
      { error: "No non-canonical move linked to this issue" },
      { status: 400 }
    );
  }

  const ncm = issue.nonCanonicalMove;

  // Check authorization: only assignee (content author) can reject
  if (issue.assigneeId && issue.assigneeId.toString() !== uid) {
    return NextResponse.json(
      { error: "Only the assigned author can reject this response" },
      { status: 403 }
    );
  }

  // Check if already rejected
  if (ncm.status === "REJECTED") {
    return NextResponse.json(
      { error: "This response has already been rejected" },
      { status: 400 }
    );
  }

  // Update NCM status to REJECTED
  await prisma.nonCanonicalMove.update({
    where: { id: ncm.id },
    data: {
      status: "REJECTED",
      rejectedBy: String(uid),
      rejectedAt: new Date(),
      rejectionReason: body.reviewNotes,
    },
  });

  // Close the issue with rejection notes
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      state: "closed",
      ncmStatus: "REJECTED",
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes,
      closedById: uid,
      closedAt: new Date(),
    },
  });

  // Emit bus events
  try {
    emitBus("issues:changed", { deliberationId });
  } catch (err) {
    console.error("Failed to emit bus events:", err);
  }

  return NextResponse.json({
    ok: true,
    rejected: true,
  });
}
