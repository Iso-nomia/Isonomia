export const dynamic = "force-dynamic";

// app/api/assumptions/[id]/challenge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

/**
 * POST /api/assumptions/[id]/challenge
 * Challenge an assumption and change its status to CHALLENGED.
 * Optionally provide a reason for the challenge.
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
    const body = await request.json();
    const { reason } = body;

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
    if (assumption.status === "RETRACTED") {
      return NextResponse.json(
        { error: "Cannot challenge a retracted assumption" },
        { status: 400 }
      );
    }

    if (assumption.status === "CHALLENGED") {
      return NextResponse.json(
        { error: "Assumption is already under challenge" },
        { status: 400 }
      );
    }

    // Update status to CHALLENGED
    const updated = await prisma.assumptionUse.update({
      where: { id: assumptionId },
      data: {
        status: "CHALLENGED",
        statusChangedAt: new Date(),
        statusChangedBy: user.userId.toString(),
        challengeReason: reason || null,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error challenging assumption:", error);
    return NextResponse.json(
      { error: "Failed to challenge assumption" },
      { status: 500 }
    );
  }
}
