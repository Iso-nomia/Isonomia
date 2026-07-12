export const dynamic = "force-dynamic";

// app/api/cqs/responses/[id]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { canModerateResponse } from "@/lib/cqs/permissions";

const RejectSchema = z.object({
  reason: z.string().min(10).max(500), // Required reason for rejection
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const responseId = params.id;

  const parsed = RejectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { reason } = parsed.data;

  // Check if response exists
  const response = await prisma.cQResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      cqStatusId: true,
      contributorId: true,
      responseStatus: true,
    },
  });

  if (!response) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  // Check permissions
  const canModerate = await canModerateResponse(String(userId), responseId);
  if (!canModerate) {
    return NextResponse.json(
      { error: "Only claim author or moderator can reject responses" },
      { status: 403 }
    );
  }

  // Can only reject pending responses
  if (response.responseStatus !== "PENDING") {
    return NextResponse.json(
      { error: `Cannot reject ${response.responseStatus.toLowerCase()} response` },
      { status: 409 }
    );
  }

  // Update response
  const updated = await prisma.cQResponse.update({
    where: { id: responseId },
    data: {
      responseStatus: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: String(userId),
      reviewNotes: reason,
    },
  });

  // Check if CQ should revert to OPEN (no more pending)
  const remainingPending = await prisma.cQResponse.count({
    where: {
      cqStatusId: response.cqStatusId,
      responseStatus: "PENDING",
    },
  });

  if (remainingPending === 0) {
    await prisma.cQStatus.update({
      where: { id: response.cqStatusId },
      data: {
        statusEnum: "OPEN",
        lastReviewedAt: new Date(),
        lastReviewedBy: String(userId),
      },
    });
  }

  // Log activity
  await prisma.cQActivityLog.create({
    data: {
      cqStatusId: response.cqStatusId,
      action: "RESPONSE_REJECTED",
      actorId: String(userId),
      responseId,
      metadata: {
        reason,
      },
    },
  });

  // TODO Phase 4: Emit notification to contributor
  // emitBus('cq:response:rejected', { responseId, contributorId: response.contributorId, reason });

  return NextResponse.json({
    ok: true,
    message: "Response rejected",
  });
}
