export const dynamic = "force-dynamic";

// app/api/cqs/responses/[id]/withdraw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { isResponseContributor } from "@/lib/cqs/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const responseId = params.id;

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

  // Check if user is the contributor
  const isContributor = await isResponseContributor(String(userId), responseId);
  if (!isContributor) {
    return NextResponse.json(
      { error: "You can only withdraw your own responses" },
      { status: 403 }
    );
  }

  // Can only withdraw pending or approved responses (not canonical or rejected)
  if (response.responseStatus === "CANONICAL") {
    return NextResponse.json(
      { error: "Cannot withdraw canonical response. Contact claim author to replace it." },
      { status: 409 }
    );
  }

  if (response.responseStatus === "WITHDRAWN") {
    return NextResponse.json(
      { error: "Response already withdrawn" },
      { status: 409 }
    );
  }

  // Update response to WITHDRAWN
  await prisma.cQResponse.update({
    where: { id: responseId },
    data: {
      responseStatus: "WITHDRAWN",
    },
  });

  // Check if CQ should revert status
  const remainingActive = await prisma.cQResponse.count({
    where: {
      cqStatusId: response.cqStatusId,
      responseStatus: { in: ["PENDING", "APPROVED"] },
    },
  });

  if (remainingActive === 0) {
    await prisma.cQStatus.update({
      where: { id: response.cqStatusId },
      data: { statusEnum: "OPEN" },
    });
  }

  // Log activity
  await prisma.cQActivityLog.create({
    data: {
      cqStatusId: response.cqStatusId,
      action: "RESPONSE_WITHDRAWN",
      actorId: String(userId),
      responseId,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Response withdrawn successfully",
  });
}
