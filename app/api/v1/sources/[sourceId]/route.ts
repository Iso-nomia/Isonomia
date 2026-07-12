export const dynamic = "force-dynamic";

/**
 * Public Sources API - Get Single Source
 *
 * @route GET /api/v1/sources/[sourceId]
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
  params: Promise<{ sourceId: string }>;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req);
}

/**
 * Get a source by ID
 *
 * Query params:
 * - include: Comma-separated list of relations to include (citations, stacks)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  // Authenticate
  const auth = await apiMiddleware(req, ["read:sources"]);
  if (!auth.authorized) return auth.error!;

  const { sourceId } = await params;
  const { searchParams } = new URL(req.url);
  const include = searchParams.get("include")?.split(",") || [];

  try {
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        // Conditionally include citations
        ...(include.includes("citations") && {
          citations: {
            select: {
              id: true,
              targetId: true,
              targetType: true,
              intent: true,
              quote: true,
              locator: true,
              createdAt: true,
            },
            take: 50,
          },
        }),
        _count: {
          select: { citations: true },
        },
      },
    });

    if (!source) {
      return apiError("not_found", "Source not found", 404);
    }

    // Transform response
    const data = {
      id: source.id,
      title: source.title,
      authors: parseAuthors(source.authorsJson),
      year: source.year,
      doi: source.doi,
      url: source.url,
      type: source.kind,
      container: source.container,
      publisher: source.publisher,
      volume: source.volume,
      issue: source.issue,
      pages: source.pages,
      abstract: source.abstractText,
      pdfUrl: source.pdfUrl,
      citationCount: source._count.citations,
      verification: {
        status: source.verificationStatus,
        verifiedAt: source.verifiedAt,
        httpStatus: source.httpStatus,
        lastCheckedAt: source.lastCheckedAt,
      },
      // Optional includes
      ...(include.includes("citations") && {
        citations: (source as { citations?: unknown }).citations,
      }),
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };

    return apiSuccess(data);
  } catch (error) {
    console.error("[API] Get source error:", error);
    return apiError("fetch_failed", "Failed to fetch source", 500);
  }
}

/**
 * Parse authors from JSON value, JSON string, or array
 */
function parseAuthors(authors: unknown): Array<{ name: string }> {
  if (!authors) return [];

  const toName = (a: unknown): { name: string } => {
    if (typeof a === "string") return { name: a };
    if (a && typeof a === "object") {
      const obj = a as { name?: string; family?: string; given?: string };
      if (obj.name) return { name: obj.name };
      const composed = [obj.given, obj.family].filter(Boolean).join(" ").trim();
      return { name: composed };
    }
    return { name: "" };
  };

  if (Array.isArray(authors)) {
    return authors.map(toName);
  }

  if (typeof authors === "string") {
    try {
      const parsed = JSON.parse(authors);
      if (Array.isArray(parsed)) {
        return parsed.map(toName);
      }
    } catch {
      return authors.split(",").map((a) => ({ name: a.trim() }));
    }
  }

  return [];
}
