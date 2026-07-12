export const dynamic = "force-dynamic";

// app/api/cqs/responses/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { canModerateResponse } from "@/lib/cqs/permissions";

const ApproveSchema = z.object({
  setAsCanonical: z.boolean().optional().default(false),
  reviewNotes: z.string().max(1000).optional(),
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

  const parsed = ApproveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { setAsCanonical, reviewNotes } = parsed.data;

  // Check if response exists
  const response = await prisma.cQResponse.findUnique({
    where: { id: responseId },
    include: {
      cqStatus: {
        select: {
          id: true,
          targetId: true,
          targetType: true,
          statusEnum: true,
          canonicalResponseId: true,
        },
      },
    },
  });

  if (!response) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  // Check permissions
  const canModerate = await canModerateResponse(String(userId), responseId);
  if (!canModerate) {
    return NextResponse.json(
      { error: "Only claim author or moderator can approve responses" },
      { status: 403 }
    );
  }

  // Can't approve already approved/canonical/rejected responses
  if (response.responseStatus !== "PENDING") {
    return NextResponse.json(
      { error: `Response is already ${response.responseStatus.toLowerCase()}` },
      { status: 409 }
    );
  }

  const newStatus = setAsCanonical ? "CANONICAL" : "APPROVED";

  // If setting as canonical, supersede old canonical
  if (setAsCanonical && response.cqStatus.canonicalResponseId) {
    await prisma.cQResponse.update({
      where: { id: response.cqStatus.canonicalResponseId },
      data: { responseStatus: "SUPERSEDED" },
    });
  }

  // Update response
  const updated = await prisma.cQResponse.update({
    where: { id: responseId },
    data: {
      responseStatus: newStatus,
      reviewedAt: new Date(),
      reviewedBy: String(userId),
      reviewNotes,
    },
  });

  // Update CQ status
  const cqStatusUpdate: any = {
    lastReviewedAt: new Date(),
    lastReviewedBy: String(userId),
  };

  if (setAsCanonical) {
    cqStatusUpdate.canonicalResponseId = responseId;
    cqStatusUpdate.statusEnum = "SATISFIED";
  } else {
    // If not canonical, set to PARTIALLY_SATISFIED
    cqStatusUpdate.statusEnum = "PARTIALLY_SATISFIED";
  }

  await prisma.cQStatus.update({
    where: { id: response.cqStatusId },
    data: cqStatusUpdate,
  });

  // Log activity
  await prisma.cQActivityLog.create({
    data: {
      cqStatusId: response.cqStatusId,
      action: setAsCanonical ? "CANONICAL_SELECTED" : "RESPONSE_APPROVED",
      actorId: String(userId),
      responseId,
      metadata: {
        reviewNotes,
        wasCanonical: setAsCanonical,
      },
    },
  });

  // TODO Phase 4: Emit notification to contributor
  // emitBus('cq:response:approved', { responseId, contributorId: response.contributorId });

  return NextResponse.json({
    ok: true,
    response: {
      id: updated.id,
      responseStatus: updated.responseStatus,
      reviewedAt: updated.reviewedAt,
    },
    message: setAsCanonical
      ? "Response approved and set as canonical answer"
      : "Response approved",
  });
}
