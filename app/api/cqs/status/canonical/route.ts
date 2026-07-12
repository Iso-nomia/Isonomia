export const dynamic = "force-dynamic";

// app/api/cqs/status/canonical/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { canModerateResponse } from "@/lib/cqs/permissions";

const CanonicalSchema = z.object({
  cqStatusId: z.string().min(1),
  responseId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CanonicalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { cqStatusId, responseId } = parsed.data;

  // Verify response belongs to this CQ
  const response = await prisma.cQResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      cqStatusId: true,
      responseStatus: true,
      contributorId: true,
    },
  });

  if (!response) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  if (response.cqStatusId !== cqStatusId) {
    return NextResponse.json(
      { error: "Response does not belong to this CQ" },
      { status: 400 }
    );
  }

  // Check permissions
  const canModerate = await canModerateResponse(String(userId), responseId);
  if (!canModerate) {
    return NextResponse.json(
      { error: "Only claim author or moderator can set canonical response" },
      { status: 403 }
    );
  }

  // Response must be approved or already canonical
  if (!["APPROVED", "CANONICAL"].includes(response.responseStatus)) {
    return NextResponse.json(
      { error: "Only approved responses can be set as canonical" },
      { status: 409 }
    );
  }

  // Get current CQ status
  const cqStatus = await prisma.cQStatus.findUnique({
    where: { id: cqStatusId },
    select: { canonicalResponseId: true },
  });

  if (!cqStatus) {
    return NextResponse.json({ error: "CQ not found" }, { status: 404 });
  }

  // If there's an existing canonical, supersede it
  if (cqStatus.canonicalResponseId && cqStatus.canonicalResponseId !== responseId) {
    await prisma.cQResponse.update({
      where: { id: cqStatus.canonicalResponseId },
      data: { responseStatus: "SUPERSEDED" },
    });
  }

  // Set new canonical
  await prisma.cQResponse.update({
    where: { id: responseId },
    data: { responseStatus: "CANONICAL" },
  });

  await prisma.cQStatus.update({
    where: { id: cqStatusId },
    data: {
      canonicalResponseId: responseId,
      statusEnum: "SATISFIED",
      lastReviewedAt: new Date(),
      lastReviewedBy: String(userId),
    },
  });

  // Log activity
  await prisma.cQActivityLog.create({
    data: {
      cqStatusId,
      action: "CANONICAL_SELECTED",
      actorId: String(userId),
      responseId,
      metadata: {
        previousCanonical: cqStatus.canonicalResponseId,
      },
    },
  });

  // TODO Phase 4: Emit notification
  // emitBus('cq:canonical:selected', { cqStatusId, responseId, contributorId: response.contributorId });

  return NextResponse.json({
    ok: true,
    message: "Canonical response set successfully",
  });
}
