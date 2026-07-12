export const dynamic = "force-dynamic";

// app/api/assumptions/[id]/accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

/**
 * POST /api/assumptions/[id]/accept
 * Accept a proposed assumption and change its status to ACCEPTED.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assumptionId = params.id;

    // Fetch the assumption
    const assumption = await prisma.assumptionUse.findUnique({
      where: { id: assumptionId },
      select: {
        id: true,
        status: true,
        deliberationId: true,
      },
    });

    if (!assumption) {
      return NextResponse.json(
        { error: "Assumption not found" },
        { status: 404 }
      );
    }

    // Validate state transition
    if (assumption.status === "ACCEPTED") {
      return NextResponse.json(
        { error: "Assumption is already accepted" },
        { status: 400 }
      );
    }

    if (assumption.status === "RETRACTED") {
      return NextResponse.json(
        { error: "Cannot accept a retracted assumption" },
        { status: 400 }
      );
    }

    // Update status to ACCEPTED
    const updated = await prisma.assumptionUse.update({
      where: { id: assumptionId },
      data: {
        status: "ACCEPTED",
        statusChangedAt: new Date(),
        statusChangedBy: user.userId.toString(),
        challengeReason: null, // Clear challenge reason if any
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error accepting assumption:", error);
    return NextResponse.json(
      { error: "Failed to accept assumption" },
      { status: 500 }
    );
  }
}
