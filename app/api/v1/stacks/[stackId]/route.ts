export const dynamic = "force-dynamic";

/**
 * Public Stacks API - Get Single Stack
 *
 * @route GET /api/v1/stacks/[stackId]
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiMiddleware,
  apiSuccess,
  apiError,
  handleCorsPreFlight,
} from "@/lib/api/middleware";

interface RouteParams {
  params: Promise<{ stackId: string }>;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req);
}

/**
 * Get a stack by ID
 *
 * Query params:
 * - include: Comma-separated list of relations (items, collaborators)
 * - itemLimit: Max items to return (default 50, max 200)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  // Authenticate
  const auth = await apiMiddleware(req, ["read:stacks"]);
  if (!auth.authorized) return auth.error!;

  const { stackId } = await params;
  const { searchParams } = new URL(req.url);
  const include = searchParams.get("include")?.split(",") || [];
  const itemLimit = Math.min(200, Math.max(1, parseInt(searchParams.get("itemLimit") || "50", 10)));

  try {
    const stack = await prisma.stack.findUnique({
      where: { id: stackId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        // Conditionally include items
        ...(include.includes("items") && {
          items: {
            take: itemLimit,
            orderBy: { position: "asc" },
            include: {
              block: {
                select: {
                  id: true,
                  title: true,
                  linkUrl: true,
                  blockType: true,
                  created_at: true,
                },
              },
            },
          },
        }),
        // Conditionally include collaborators
        ...(include.includes("collaborators") && {
          collaborators: {
            select: {
              user_id: true,
              role: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
        }),
        _count: {
          select: {
            items: true,
            collaborators: true,
            subscribers: true,
          },
        },
      },
    });

    if (!stack) {
      return apiError("not_found", "Stack not found", 404);
    }

    // Check visibility
    const isPublic =
      stack.visibility === "public_open" ||
      stack.visibility === "public_closed" ||
      stack.visibility === "unlisted";

    const isOwner = stack.owner_id.toString() === auth.user?.id?.toString();

    if (!isPublic && !isOwner) {
      return apiError("forbidden", "This stack is private", 403);
    }

    // Transform response
    const data: Record<string, unknown> = {
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
    };

    // Add items if requested
    if (include.includes("items") && "items" in stack && stack.items) {
      data.items = (stack.items as any[]).map((item) => ({
        id: item.id,
        order: item.position,
        notes: item.note,
        source: item.block
          ? {
              id: item.block.id,
              title: item.block.title,
              url: item.block.linkUrl,
              type: item.block.blockType,
            }
          : null,
        createdAt: item.createdAt,
      }));
    }

    // Add collaborators if requested
    if (
      include.includes("collaborators") &&
      "collaborators" in stack &&
      stack.collaborators
    ) {
      data.collaborators = (stack.collaborators as any[]).map((collab) => ({
        id: collab.user_id.toString(),
        role: collab.role,
        user: {
          id: collab.user.id.toString(),
          username: collab.user.username,
          name: collab.user.name,
        },
      }));
    }

    return apiSuccess(data);
  } catch (error) {
    console.error("[API] Get stack error:", error);
    return apiError("fetch_failed", "Failed to fetch stack", 500);
  }
}

/**
 * Parse authors from JSON string or array
 */
function parseAuthors(authors: string | null): Array<{ name: string }> {
  if (!authors) return [];

  try {
    const parsed = JSON.parse(authors);
    if (Array.isArray(parsed)) {
      return parsed.map((a: string | { name?: string }) =>
        typeof a === "string" ? { name: a } : { name: a.name || "" }
      );
    }
  } catch {
    return authors.split(",").map((a) => ({ name: a.trim() }));
  }

  return [];
}
