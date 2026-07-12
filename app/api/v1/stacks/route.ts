export const dynamic = "force-dynamic";

/**
 * Public Stacks API - List/Search
 *
 * @route GET /api/v1/stacks
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiMiddleware,
  apiPaginated,
  apiError,
  handleCorsPreFlight,
} from "@/lib/api/middleware";

/**
 * Handle CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req);
}

/**
 * Search and list public stacks
 *
 * Query params:
 * - q: Search query (searches name, description)
 * - userId: Filter by owner ID
 * - visibility: Filter by visibility (public_open, public_closed, unlisted)
 * - limit: Number of results (max 50, default 20)
 * - cursor: Pagination cursor
 */
export async function GET(req: NextRequest) {
  // Authenticate
  const auth = await apiMiddleware(req, ["read:stacks"]);
  if (!auth.authorized) return auth.error!;

  const { searchParams } = new URL(req.url);

  // Parse query parameters
  const q = searchParams.get("q");
  const userId = searchParams.get("userId");
  const visibility = searchParams.get("visibility");
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const cursor = searchParams.get("cursor");

  // Build where clause - only show public stacks by default
  const where: Record<string, unknown> = {
    visibility: {
      in: ["public_open", "public_closed", "unlisted"],
    },
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (userId) {
    try {
      where.ownerId = BigInt(userId);
    } catch {
      return apiError("invalid_parameter", "Invalid userId format", 400);
    }
  }

  if (visibility) {
    const allowedVisibilities = ["public_open", "public_closed", "unlisted"];
    if (!allowedVisibilities.includes(visibility)) {
      return apiError(
        "invalid_parameter",
        `visibility must be one of: ${allowedVisibilities.join(", ")}`,
        400
      );
    }
    where.visibility = visibility;
  }

  try {
    // Fetch stacks with pagination
    const stacks = await prisma.stack.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        created_at: true,
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
            collaborators: true,
            subscribers: true,
          },
        },
      },
    });

    // Check if there are more results
    const hasMore = stacks.length > limit;
    const results = hasMore ? stacks.slice(0, -1) : stacks;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    // Transform results
    const data = results.map((stack) => ({
      id: stack.id,
      name: stack.name,
      description: stack.description,
      visibility: stack.visibility,
      owner: {
        id: stack.owner.id.toString(),
        username: stack.owner.username,
        name: stack.owner.name,
      },
      itemCount: stack._count.items,
      collaboratorCount: stack._count.collaborators,
      subscriberCount: stack._count.subscribers,
      createdAt: stack.created_at,
    }));

    return apiPaginated(data, { hasMore, nextCursor });
  } catch (error) {
    console.error("[API] Stacks search error:", error);
    return apiError("search_failed", "Failed to search stacks", 500);
  }
}
