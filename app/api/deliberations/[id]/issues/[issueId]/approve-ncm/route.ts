export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/issues/[issueId]/approve-ncm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { asUserIdString } from "@/lib/auth/normalize";
import { emitBus } from "@/lib/server/bus";
import { executeNCMAsCanonical } from "@/lib/ncm/executeAsCanonical";

/**
 * POST /api/deliberations/[id]/issues/[issueId]/approve-ncm
 * Approve a non-canonical move and execute it as canonical
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

  // Check authorization: only assignee (content author) can approve
  if (issue.assigneeId && issue.assigneeId.toString() !== uid) {
    return NextResponse.json(
      { error: "Only the assigned author can approve this response" },
      { status: 403 }
    );
  }

  // Check if already approved/executed
  if (ncm.status === "APPROVED" || ncm.status === "EXECUTED") {
    return NextResponse.json(
      { error: "This response has already been approved" },
      { status: 400 }
    );
  }

  // Update NCM status to APPROVED
  await prisma.nonCanonicalMove.update({
    where: { id: ncm.id },
    data: {
      status: "APPROVED",
      approvedBy: String(uid),
      approvedAt: new Date(),
    },
  });

  // Execute as canonical move
  let canonicalMoveId: string | null = null;
  try {
    canonicalMoveId = await executeNCMAsCanonical(ncm, uid);
    
    if (!canonicalMoveId) {
      console.warn("[approve-ncm] Failed to execute NCM as canonical, but still approving");
    }
  } catch (err) {
    console.error("Failed to execute NCM as canonical:", err);
    // Don't fail the approval, just log the error
  }

  // Update NCM with execution details
  if (canonicalMoveId) {
    await prisma.nonCanonicalMove.update({
      where: { id: ncm.id },
      data: {
        status: "EXECUTED",
        canonicalMoveId,
        executedAt: new Date(),
      },
    });
  }

  // Close the issue
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      state: "closed",
      ncmStatus: canonicalMoveId ? "EXECUTED" : "APPROVED",
      reviewedAt: new Date(),
      closedById: uid,
      closedAt: new Date(),
    },
  });

  // Emit bus events
  try {
    emitBus("issues:changed", { deliberationId });
    emitBus("dialogue:changed", { deliberationId });
  } catch (err) {
    console.error("Failed to emit bus events:", err);
  }

  return NextResponse.json({
    ok: true,
    approved: true,
    executed: !!canonicalMoveId,
    canonicalMoveId,
  });
}
