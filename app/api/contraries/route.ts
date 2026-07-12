export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { isRoomModerator } from "@/lib/cqs/permissions";

const CONTRARY_STATUSES = new Set(["ACTIVE", "RETRACTED"]);

/**
 * GET /api/contraries?deliberationId=xxx&claimId=yyy
 * Fetch explicit contrary relationships
 * 
 * Query params:
 * - deliberationId (required): Filter by deliberation
 * - claimId (optional): Filter to contraries of a specific claim
 * - status (optional): Filter by status (default: ACTIVE)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");
    const claimId = searchParams.get("claimId");
    const status = searchParams.get("status") || "ACTIVE";

    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing required parameter: deliberationId" },
        { status: 400 }
      );
    }

    if (!CONTRARY_STATUSES.has(status)) {
      return NextResponse.json(
        {
          error: `Invalid status "${status}"; expected one of ${Array.from(CONTRARY_STATUSES).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      deliberationId,
      status,
    };

    // If claimId provided, find all contraries involving that claim
    // (either as the source claimId, or as the target contraryId regardless
    // of isSymmetric). The UI distinguishes outgoing vs incoming by inspecting
    // claimId/contraryId on each row.
    if (claimId) {
      where.OR = [
        { claimId },
        { contraryId: claimId },
      ];
    }

    const contraries = await prisma.claimContrary.findMany({
      where,
      include: {
        claim: {
          select: {
            id: true,
            text: true,
          },
        },
        contrary: {
          select: {
            id: true,
            text: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedContraries = contraries.map((contrary) => ({
      ...contrary,
      createdById: contrary.createdById.toString(),
      createdBy: {
        ...contrary.createdBy,
        id: contrary.createdBy.id.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      contraries: serializedContraries,
      count: serializedContraries.length,
    });
  } catch (error) {
    console.error("[Contraries API] Error fetching contraries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contraries?deliberationId=xxx&contraryId=yyy
 * Soft-delete a contrary relationship (creator or moderator/admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId().catch(() => null);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const contraryId = searchParams.get("contraryId");
    const deliberationId = searchParams.get("deliberationId");

    if (!contraryId) {
      return NextResponse.json(
        { error: "Missing required parameter: contraryId" },
        { status: 400 }
      );
    }
    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing required parameter: deliberationId" },
        { status: 400 }
      );
    }

    const existing = await prisma.claimContrary.findUnique({
      where: { id: contraryId },
      select: { id: true, createdById: true, deliberationId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contrary not found" }, { status: 404 });
    }
    if (existing.deliberationId !== deliberationId) {
      // Don't reveal cross-deliberation existence
      return NextResponse.json({ error: "Contrary not found" }, { status: 404 });
    }

    const isOwner = existing.createdById.toString() === String(userId);
    // isRoomModerator currently performs a global moderator/admin role check;
    // pass deliberationId for forward-compatibility when scoped roles land.
    const isMod = isOwner ? false : await isRoomModerator(String(userId), deliberationId).catch(() => false);

    if (!isOwner && !isMod) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (existing.status === "RETRACTED") {
      return NextResponse.json({ success: true, contraryId: existing.id, alreadyRetracted: true });
    }

    const updated = await prisma.claimContrary.update({
      where: { id: contraryId },
      data: { status: "RETRACTED" },
    });

    return NextResponse.json({
      success: true,
      contraryId: updated.id,
    });
  } catch (error) {
    console.error("[Contraries API] Error deleting contrary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
