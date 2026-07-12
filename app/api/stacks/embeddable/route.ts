export const dynamic = "force-dynamic";

/**
 * GET /api/stacks/embeddable
 * 
 * Phase 1.4 of Stacks Improvement Roadmap
 * 
 * Returns stacks that can be embedded by the current user.
 * This includes public stacks and stacks the user owns or collaborates on.
 * 
 * Query params:
 *   - excludeId: string - Stack ID to exclude (the parent stack)
 *   - search: string - Search filter for stack names
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = BigInt(user.userId);
    const { searchParams } = new URL(req.url);
    const excludeId = searchParams.get("excludeId");
    const search = searchParams.get("search")?.toLowerCase();

    // Build filter conditions
    const whereConditions: any = {
      AND: [
        // Exclude the parent stack
        excludeId ? { id: { not: excludeId } } : {},
        // User can embed discoverable stacks or stacks they have access to
        {
          OR: [
            // Discoverable stacks (public_open, public_closed)
            { visibility: { in: ["public_open", "public_closed"] } },
            // Fallback for un-migrated stacks
            { visibility: null, is_public: true },
            // User's own stacks
            { owner_id: userId },
            // Collaborator access
            { collaborators: { some: { user_id: userId } } },
          ],
        },
        // Search filter
        search ? { name: { contains: search, mode: "insensitive" } } : {},
      ],
    };

    const stacks = await prisma.stack.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        is_public: true,
        owner_id: true,
        owner: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: { items: { where: { kind: "block" } } },
        },
      },
      orderBy: [
        // Prioritize user's own stacks
        { owner_id: "asc" },
        { name: "asc" },
      ],
      take: 50, // Limit results
    });

    // Sort to put user's own stacks first
    const sortedStacks = stacks.sort((a, b) => {
      const aOwned = a.owner_id === userId ? 0 : 1;
      const bOwned = b.owner_id === userId ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
      return a.name.localeCompare(b.name);
    });

    // Map to response format
    const response = sortedStacks.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      isPublic: s.is_public,
      isOwner: s.owner_id === userId,
      owner: {
        id: String(s.owner.id),
        name: s.owner.name,
        username: s.owner.username,
      },
      _count: { items: s._count.items },
    }));

    return NextResponse.json({ stacks: response });
  } catch (err) {
    console.error("Error in GET /api/stacks/embeddable:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
