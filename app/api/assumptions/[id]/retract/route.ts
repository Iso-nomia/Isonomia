export const dynamic = "force-dynamic";

// app/api/assumptions/[id]/retract/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { batchLazyRecompute } from "@/lib/evidential/lazy-recompute";
import { recomputeGroundedForDelib } from "@/lib/ceg/grounded";

/**
 * POST /api/assumptions/[id]/retract
 * Retract an assumption and change its status to RETRACTED.
 *
 * Sprint D4: after the status flip, recompute affected argument support
 * (`batchLazyRecompute`) and re-run grounded labels for the deliberation
 * (`recomputeGroundedForDelib`). Both are best-effort: failures here
 * never roll back the retraction itself.
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
        argumentId: true,
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
        { error: "Assumption is already retracted" },
        { status: 400 }
      );
    }

    // Update status to RETRACTED
    const updated = await prisma.assumptionUse.update({
      where: { id: assumptionId },
      data: {
        status: "RETRACTED",
        statusChangedAt: new Date(),
        statusChangedBy: user.userId.toString(),
      },
    });

    // Sprint D4 cascade: recompute support for the affected argument and
    // re-run grounded labels so downstream claims reflect the retraction.
    if (assumption.argumentId) {
      await batchLazyRecompute([assumption.argumentId]).catch((err) => {
        console.error("[retract] batchLazyRecompute failed:", err);
      });
    }
    if (assumption.deliberationId) {
      await recomputeGroundedForDelib(assumption.deliberationId).catch((err) => {
        console.error("[retract] recomputeGroundedForDelib failed:", err);
      });
    }

    // Mark any open belief-revision proposals that referenced this
    // assumption as APPLIED so the panel collapses on next read.
    await prisma.beliefRevisionProposal
      .updateMany({
        where: {
          status: "OPEN",
          ...(assumption.argumentId ? { argumentId: assumption.argumentId } : {}),
        },
        data: { status: "APPLIED" },
      })
      .catch((err) => console.error("[retract] proposal mark-applied failed:", err));

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error retracting assumption:", error);
    return NextResponse.json(
      { error: "Failed to retract assumption" },
      { status: 500 }
    );
  }
}
