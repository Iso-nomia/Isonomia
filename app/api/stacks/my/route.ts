export const dynamic = "force-dynamic";

/**
 * GET /api/stacks/my
 * 
 * Phase 1.3 of Stacks Improvement Roadmap
 * 
 * Returns stacks owned by or accessible to the current user.
 * Query params:
 *   - includeCollaborator=true: Include stacks where user is a collaborator
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  try {
    const u = await getUserFromCookies();
    if (!u?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = BigInt(u.userId);
    const { searchParams } = new URL(req.url);
    const includeCollaborator = searchParams.get("includeCollaborator") === "true";

    // Build OR conditions
    const orConditions: any[] = [{ owner_id: userId }];

    if (includeCollaborator) {
      orConditions.push({
        collaborators: {
          some: { user_id: userId },
        },
      });
    }

    const stacks = await prisma.stack.findMany({
      where: {
        OR: orConditions,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        owner_id: true,
        is_public: true,
        created_at: true,
        _count: {
          select: {
            items: { where: { kind: "block" } },
            posts: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Map to response format
    const response = stacks.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      isOwner: s.owner_id === userId,
      isPublic: s.is_public,
      itemCount: s._count.items || s._count.posts,
      createdAt: s.created_at.toISOString(),
    }));

    return NextResponse.json({ stacks: response });
  } catch (err) {
    console.error("Error in GET /api/stacks/my:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
