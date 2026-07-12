export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/roles/route.ts
//
// Governance role management for a deliberation (docs/DELIBERATION_CREATION_DEV_SPEC.md §2.2).
// Currently scoped to moderator management; only the deliberation creator (owner)
// may add or remove moderators.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { jsonSafe } from "@/lib/bigintjson";
import { DELIBERATION_GOVERNANCE_ROLES } from "@/lib/deliberations/governance";

/**
 * GET /api/deliberations/[id]/roles
 * Returns the creator and the list of moderators (with basic user info).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, createdById: true },
    });

    if (!deliberation) {
      return NextResponse.json({ error: "Deliberation not found" }, { status: 404 });
    }

    const moderatorRows = await prisma.deliberationRole.findMany({
      where: { deliberationId, role: DELIBERATION_GOVERNANCE_ROLES.MODERATOR },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Resolve user info for creator + moderators in a single query.
    const userIds = [deliberation.createdById, ...moderatorRows.map((r) => r.userId)]
      .filter(Boolean)
      .map((id) => {
        try {
          return BigInt(id);
        } catch {
          return null;
        }
      })
      .filter((v): v is bigint => v !== null);

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, name: true, image: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    const creator = userMap.get(deliberation.createdById) ?? null;
    const moderators = moderatorRows.map((r) => ({
      userId: r.userId,
      addedAt: r.createdAt,
      user: userMap.get(r.userId) ?? null,
    }));

    return NextResponse.json(
      jsonSafe({
        deliberationId,
        creator: { userId: deliberation.createdById, user: creator },
        moderators,
      })
    );
  } catch (error) {
    console.error("Error fetching deliberation roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

/**
 * POST /api/deliberations/[id]/roles
 * Add a moderator. Body: { username?: string; userId?: string }.
 * Only the creator may add moderators.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getCurrentUserId();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deliberationId = params.id;
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { createdById: true },
    });
    if (!deliberation) {
      return NextResponse.json({ error: "Deliberation not found" }, { status: 404 });
    }
    if (deliberation.createdById !== String(me)) {
      return NextResponse.json({ error: "Only the creator can manage moderators" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const rawUserId = typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!username && !rawUserId) {
      return NextResponse.json({ error: "Provide a username or userId" }, { status: 400 });
    }

    // Resolve the target user.
    let targetUser:
      | { id: bigint; username: string; name: string; image: string | null }
      | null = null;

    if (rawUserId) {
      let bigId: bigint | null = null;
      try {
        bigId = BigInt(rawUserId);
      } catch {
        bigId = null;
      }
      if (bigId !== null) {
        targetUser = await prisma.user.findUnique({
          where: { id: bigId },
          select: { id: true, username: true, name: true, image: true },
        });
      }
    } else if (username) {
      targetUser = await prisma.user.findFirst({
        where: { username },
        select: { id: true, username: true, name: true, image: true },
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetId = targetUser.id.toString();
    if (targetId === deliberation.createdById) {
      return NextResponse.json(
        { error: "The creator already has full authority" },
        { status: 400 }
      );
    }

    await prisma.deliberationRole.upsert({
      where: {
        deliberationId_userId_role: {
          deliberationId,
          userId: targetId,
          role: DELIBERATION_GOVERNANCE_ROLES.MODERATOR,
        },
      },
      create: {
        deliberationId,
        userId: targetId,
        role: DELIBERATION_GOVERNANCE_ROLES.MODERATOR,
        invitedById: String(me),
      },
      update: {},
    });

    return NextResponse.json(
      jsonSafe({
        ok: true,
        moderator: {
          userId: targetId,
          user: targetUser,
        },
      })
    );
  } catch (error) {
    console.error("Error adding moderator:", error);
    return NextResponse.json({ error: "Failed to add moderator" }, { status: 500 });
  }
}

/**
 * DELETE /api/deliberations/[id]/roles?userId=...
 * Remove a moderator. Only the creator may remove moderators.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getCurrentUserId();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deliberationId = params.id;
    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { createdById: true },
    });
    if (!deliberation) {
      return NextResponse.json({ error: "Deliberation not found" }, { status: 404 });
    }
    if (deliberation.createdById !== String(me)) {
      return NextResponse.json({ error: "Only the creator can manage moderators" }, { status: 403 });
    }

    await prisma.deliberationRole.deleteMany({
      where: {
        deliberationId,
        userId,
        role: DELIBERATION_GOVERNANCE_ROLES.MODERATOR,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error removing moderator:", error);
    return NextResponse.json({ error: "Failed to remove moderator" }, { status: 500 });
  }
}
