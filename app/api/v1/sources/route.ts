export const dynamic = "force-dynamic";

/**
 * Public Sources API - List/Search
 *
 * @route GET /api/v1/sources
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
 * Search and list sources
 *
 * Query params:
 * - q: Search query (searches title, abstract)
 * - doi: Filter by DOI
 * - type: Filter by source type
 * - verified: Filter by verification status (true/false)
 * - limit: Number of results (max 100, default 20)
 * - cursor: Pagination cursor
 */
export async function GET(req: NextRequest) {
  // Authenticate
  const auth = await apiMiddleware(req, ["read:sources"]);
  if (!auth.authorized) return auth.error!;

  const { searchParams } = new URL(req.url);

  // Parse query parameters
  const q = searchParams.get("q");
  const doi = searchParams.get("doi");
  const type = searchParams.get("type");
  const verified = searchParams.get("verified");
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const cursor = searchParams.get("cursor");

  // Build where clause
  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { abstractText: { contains: q, mode: "insensitive" } },
    ];
  }

  if (doi) {
    where.doi = doi;
  }

  if (type) {
    where.kind = type;
  }

  if (verified !== null) {
    if (verified === "true") {
      where.verificationStatus = { not: "unverified" };
    } else if (verified === "false") {
      where.verificationStatus = "unverified";
    }
  }

  try {
    // Fetch sources with pagination
    const sources = await prisma.source.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's more
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        authorsJson: true,
        year: true,
        doi: true,
        url: true,
        kind: true,
        container: true,
        publisher: true,
        volume: true,
        issue: true,
        pages: true,
        abstractText: true,
        createdAt: true,
        updatedAt: true,
        verificationStatus: true,
        verifiedAt: true,
        _count: {
          select: { citations: true },
        },
      },
    });

    // Check if there are more results
    const hasMore = sources.length > limit;
    const results = hasMore ? sources.slice(0, -1) : sources;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    // Transform results
    const data = results.map((source) => ({
      id: source.id,
      title: source.title,
      authors: parseAuthors(source.authorsJson),
      year: source.year ?? null,
      publicationDate: source.year ? new Date(source.year, 0, 1) : null,
      doi: source.doi,
      url: source.url,
      type: source.kind,
      container: source.container,
      publisher: source.publisher,
      volume: source.volume,
      issue: source.issue,
      pages: source.pages,
      abstract: source.abstractText?.slice(0, 500), // Truncate for list view
      isOpenAccess: null,
      verificationStatus: source.verificationStatus || "unverified",
      citationCount: source._count.citations,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    }));

    return apiPaginated(data, { hasMore, nextCursor });
  } catch (error) {
    console.error("[API] Sources search error:", error);
    return apiError("search_failed", "Failed to search sources", 500);
  }
}

/**
 * Parse authors from JSON value (string, array, or CSL-esque objects)
 */
function parseAuthors(authors: unknown): Array<{ name: string }> {
  if (!authors) return [];

  // Already-parsed JSON array (e.g. from a Json Prisma column)
  if (Array.isArray(authors)) {
    return authors.map((a: unknown) => {
      if (typeof a === "string") return { name: a };
      if (a && typeof a === "object") {
        const obj = a as { name?: string; family?: string; given?: string };
        const name =
          obj.name ||
          [obj.given, obj.family].filter(Boolean).join(" ").trim();
        return { name: name || "" };
      }
      return { name: "" };
    });
  }

  if (typeof authors === "string") {
    try {
      const parsed = JSON.parse(authors);
      if (Array.isArray(parsed)) {
        return parsed.map((a: string | { name?: string }) =>
          typeof a === "string" ? { name: a } : { name: a.name || "" }
        );
      }
    } catch {
      // Treat as comma-separated string
      return authors.split(",").map((a) => ({ name: a.trim() }));
    }
  }

  return [];
}
