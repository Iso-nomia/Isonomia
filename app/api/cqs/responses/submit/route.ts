export const dynamic = "force-dynamic";

// app/api/cqs/responses/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCQPermissions } from "@/lib/cqs/permissions";

const SubmitResponseSchema = z.object({
  cqStatusId: z.string().min(1),
  groundsText: z.string().min(10).max(5000), // Min 10 chars, max 5000
  evidenceClaimIds: z.array(z.string()).optional().default([]),
  sourceUrls: z.array(z.string().url()).optional().default([]),
  deliberationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userIdStr = userId.toString();

  const parsed = SubmitResponseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { cqStatusId, groundsText, evidenceClaimIds, sourceUrls } = parsed.data;

  // Check if CQ exists
  const cqStatus = await prisma.cQStatus.findUnique({
    where: { id: cqStatusId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      roomId: true,
      schemeKey: true,
      cqKey: true,
      statusEnum: true,
    },
  });

  if (!cqStatus) {
    return NextResponse.json({ error: "CQ not found" }, { status: 404 });
  }

  // Check permissions
  const permissions = await getCQPermissions(userIdStr, cqStatusId);
  if (!permissions.canSubmitResponse) {
    return NextResponse.json(
      { error: "You do not have permission to submit responses to this CQ" },
      { status: 403 }
    );
  }

  // Verify evidence claims exist (if provided)
  if (evidenceClaimIds.length > 0) {
    const claims = await prisma.claim.findMany({
      where: { id: { in: evidenceClaimIds } },
      select: { id: true },
    });
    if (claims.length !== evidenceClaimIds.length) {
      return NextResponse.json(
        { error: "One or more evidence claims not found" },
        { status: 400 }
      );
    }
  }

  // Check if user already has a pending response for this CQ
  const existingPending = await prisma.cQResponse.findFirst({
    where: {
      cqStatusId,
      contributorId: userIdStr,
      responseStatus: "PENDING",
    },
  });

  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending response for this CQ. Please wait for review or withdraw it first." },
      { status: 409 }
    );
  }

  // Create the response
  const response = await prisma.cQResponse.create({
    data: {
      cqStatusId,
      groundsText,
      evidenceClaimIds,
      sourceUrls,
      responseStatus: "PENDING",
      contributorId: userIdStr,
    },
  });

  // Update CQ status to PENDING_REVIEW if it was OPEN
  await prisma.cQStatus.update({
    where: { id: cqStatusId },
    data: {
      statusEnum: cqStatus.statusEnum === "OPEN" ? "PENDING_REVIEW" : undefined,
    },
  });

  // Log the activity
  await prisma.cQActivityLog.create({
    data: {
      cqStatusId,
      action: "RESPONSE_SUBMITTED",
      actorId: userIdStr,
      responseId: response.id,
      metadata: {
        evidenceCount: evidenceClaimIds.length,
        sourceCount: sourceUrls.length,
      },
    },
  });

  // TODO Phase 4: Emit event for notifications
  // emitBus('cq:response:submitted', { cqStatusId, responseId: response.id, contributorId: userId });

  return NextResponse.json({
    ok: true,
    response: {
      id: response.id,
      groundsText: response.groundsText,
      responseStatus: response.responseStatus,
      createdAt: response.createdAt,
    },
    message: "Response submitted successfully. Awaiting review by claim author.",
  });
}
