export const dynamic = "force-dynamic";

/**
 * Academic Database Search API
 *
 * Provides unified search across multiple academic databases:
 * - Semantic Scholar (200M+ papers)
 * - OpenAlex (250M+ works)
 * - CrossRef (140M+ DOIs)
 *
 * @route GET /api/sources/search
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  searchAcademicDatabases,
  AcademicSearchOptions,
} from "@/lib/sources/academicSearch";

export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") || searchParams.get("query");
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required and must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Parse databases to search
    const databasesParam = searchParams.get("databases");
    const databases = databasesParam
      ? (databasesParam.split(",") as AcademicSearchOptions["databases"])
      : undefined;

    // Validate databases
    const validDatabases = ["semantic_scholar", "openalex", "crossref", "pubmed", "arxiv"];
    if (databases) {
      for (const db of databases) {
        if (!validDatabases.includes(db)) {
          return NextResponse.json(
            { error: `Invalid database: ${db}. Valid options: ${validDatabases.join(", ")}` },
            { status: 400 }
          );
        }
      }
    }

    // Parse pagination
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
      100
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    // Parse year filters
    const yearFrom = searchParams.get("yearFrom")
      ? parseInt(searchParams.get("yearFrom")!, 10)
      : undefined;
    const yearTo = searchParams.get("yearTo")
      ? parseInt(searchParams.get("yearTo")!, 10)
      : undefined;

    // Parse other filters
    const openAccessOnly = searchParams.get("openAccessOnly") === "true";

    const options: AcademicSearchOptions = {
      query: query.trim(),
      databases,
      limit,
      offset,
      yearFrom,
      yearTo,
      openAccessOnly,
    };

    const results = await searchAcademicDatabases(options);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Academic search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
