export const dynamic = "force-dynamic";

// app/api/cqs/responses/[id]/endorse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCQPermissions } from "@/lib/cqs/permissions";

const EndorseSchema = z.object({
  comment: z.string().max(500).optional(),
  weight: z.number().int().min(1).max(10).optional().default(1),
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

  const parsed = EndorseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { comment, weight } = parsed.data;

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

  // Can't endorse your own response
  if (response.contributorId === String(userId)) {
    return NextResponse.json(
      { error: "Cannot endorse your own response" },
      { status: 403 }
    );
  }

  // Check permissions (participants can endorse)
  const permissions = await getCQPermissions(String(userId), response.cqStatusId);
  if (!permissions.canEndorseResponse) {
    return NextResponse.json(
      { error: "You do not have permission to endorse responses in this deliberation" },
      { status: 403 }
    );
  }

  // Check if already endorsed
  const existing = await prisma.cQEndorsement.findUnique({
    where: {
      responseId_userId: {
        responseId,
        userId: String(userId),
      },
    },
  });

  if (existing) {
    // Update existing endorsement
    const updated = await prisma.cQEndorsement.update({
      where: { id: existing.id },
      data: { comment, weight },
    });

    return NextResponse.json({
      ok: true,
      endorsement: updated,
      message: "Endorsement updated",
    });
  }

  // Create new endorsement
  const endorsement = await prisma.cQEndorsement.create({
    data: {
      responseId,
      userId: String(userId),
      comment,
      weight,
    },
  });

  // Log activity
  await prisma.cQActivityLog.create({
    data: {
      cqStatusId: response.cqStatusId,
      action: "ENDORSEMENT_ADDED",
      actorId: String(userId),
      responseId,
      metadata: {
        weight,
        hasComment: !!comment,
      },
    },
  });

  // TODO Phase 4: Notify contributor
  // emitBus('cq:response:endorsed', { responseId, contributorId: response.contributorId });

  return NextResponse.json({
    ok: true,
    endorsement,
    message: "Response endorsed successfully",
  });
}

// DELETE endpoint to remove endorsement
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const responseId = params.id;

  // Find and delete user's endorsement
  const deleted = await prisma.cQEndorsement.deleteMany({
    where: {
      responseId,
      userId: String(userId),
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "No endorsement found to remove" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Endorsement removed",
  });
}
