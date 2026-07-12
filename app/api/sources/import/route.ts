export const dynamic = "force-dynamic";

/**
 * Academic Source Import API
 *
 * Imports sources from academic database search results.
 * Creates a Source record with metadata from Semantic Scholar,
 * OpenAlex, or CrossRef.
 *
 * @route POST /api/sources/import
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import {
  getAcademicPaper,
  searchResultToSourceData,
  AcademicSearchResult,
} from "@/lib/sources/academicSearch";
import { generateFingerprint } from "@/lib/citation/fingerprint";

interface ImportRequest {
  // Either provide the search result directly
  searchResult?: AcademicSearchResult;

  // Or provide source + externalId to fetch fresh data
  source?: "semantic_scholar" | "openalex" | "crossref";
  externalId?: string;

  // Optional: add to a specific stack
  stackId?: string;

  // Optional: skip if already exists with same DOI
  skipIfExists?: boolean;
}

/**
 * Convert authors array to CSL-JSON format
 */
function authorsToCSLJson(authors: string[]): Array<{ family?: string; given?: string; literal?: string }> {
  return authors.map((name) => {
    // Try to split "Given Family" format
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const family = parts.pop()!;
      const given = parts.join(" ");
      return { family, given };
    }
    // Single name, use as literal
    return { literal: name };
  });
}

/**
 * Map source type to schema kind
 */
function mapSourceType(sourceType: string): string {
  const mapping: Record<string, string> = {
    journal_article: "article",
    preprint: "article",
    academic_paper: "article",
    conference_paper: "article",
    workshop_paper: "article",
    book: "book",
    book_chapter: "book",
    dataset: "dataset",
    report: "other",
    thesis: "other",
    dissertation: "other",
  };
  return mapping[sourceType] || "article";
}

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: ImportRequest = await req.json();

    let searchResult: AcademicSearchResult | null = null;

    // Get the search result
    if (body.searchResult) {
      searchResult = body.searchResult;
    } else if (body.source && body.externalId) {
      // Fetch fresh data from the API
      searchResult = await getAcademicPaper(body.source, body.externalId);
      if (!searchResult) {
        return NextResponse.json(
          { error: "Paper not found in the specified database" },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Either searchResult or source+externalId required" },
        { status: 400 }
      );
    }

    // Convert to Source data format
    const sourceData = searchResultToSourceData(searchResult);

    // Check for existing source by DOI or URL
    if (body.skipIfExists !== false) {
      let existingSource = null;

      if (sourceData.doi) {
        existingSource = await prisma.source.findUnique({
          where: { doi: sourceData.doi },
        });
      }

      if (!existingSource && sourceData.url) {
        existingSource = await prisma.source.findUnique({
          where: { url: sourceData.url },
        });
      }

      if (existingSource) {
        return NextResponse.json({
          success: true,
          source: existingSource,
          created: false,
          message: "Source already exists",
        });
      }
    }

    // Generate fingerprint
    const fingerprint = generateFingerprint(
      sourceData.url,
      sourceData.doi,
      sourceData.title
    );

    // Create the source
    const source = await prisma.source.create({
      data: {
        kind: mapSourceType(sourceData.sourceType),
        title: sourceData.title,
        authorsJson: authorsToCSLJson(sourceData.authors),
        year: sourceData.publicationDate?.getFullYear() || undefined,
        container: sourceData.venue,
        doi: sourceData.doi,
        url: sourceData.url,
        fingerprint,
        createdById: String(userId),
        // Mark enrichment as done since we got data from academic DB
        enrichmentStatus: "enriched",
        enrichedAt: new Date(),
        enrichmentSource: searchResult.source,
      },
    });

    // If stackId provided, add to stack
    if (body.stackId) {
      // Find the stack and create a library post
      const stack = await prisma.stack.findUnique({
        where: { id: body.stackId },
        include: { posts: { orderBy: { created_at: "desc" }, take: 1 } },
      });

      if (stack) {
        await prisma.libraryPost.create({
          // NOTE: LibraryPost has no source linkage in the current schema
          // (no sourceId/order/createdById columns). We associate it with the
          // stack and uploader; source linkage tracked via title for now.
          data: {
            stack_id: body.stackId,
            uploader_id: BigInt(userId),
            title: source.title ?? undefined,
          } as any,
        });
      }
    }

    return NextResponse.json({
      success: true,
      source,
      created: true,
    });
  } catch (error) {
    console.error("Import error:", error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Source already exists with this DOI or URL" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Import failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Bulk import multiple sources
 */
export async function PUT(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: {
      searchResults: AcademicSearchResult[];
      stackId?: string;
      skipIfExists?: boolean;
    } = await req.json();

    if (!body.searchResults || !Array.isArray(body.searchResults)) {
      return NextResponse.json(
        { error: "searchResults array required" },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      sources: [] as Array<{ id: string; title: string; created: boolean }>,
      errors: [] as Array<{ title: string; error: string }>,
    };

    for (const searchResult of body.searchResults) {
      try {
        const sourceData = searchResultToSourceData(searchResult);

        // Check for existing
        let existingSource = null;
        if (body.skipIfExists !== false && sourceData.doi) {
          existingSource = await prisma.source.findUnique({
            where: { doi: sourceData.doi },
          });
        }

        if (existingSource) {
          results.skipped++;
          results.sources.push({
            id: existingSource.id,
            title: existingSource.title || "Untitled",
            created: false,
          });
          continue;
        }

        const fingerprint = generateFingerprint(
          sourceData.url,
          sourceData.doi,
          sourceData.title
        );

        const source = await prisma.source.create({
          data: {
            kind: mapSourceType(sourceData.sourceType),
            title: sourceData.title,
            authorsJson: authorsToCSLJson(sourceData.authors),
            year: sourceData.publicationDate?.getFullYear() || undefined,
            container: sourceData.venue,
            doi: sourceData.doi,
            url: sourceData.url,
            fingerprint,
            createdById: String(userId),
            enrichmentStatus: "enriched",
            enrichedAt: new Date(),
            enrichmentSource: searchResult.source,
          },
        });

        // Add to stack if specified
        if (body.stackId) {
          const stack = await prisma.stack.findUnique({
            where: { id: body.stackId },
            include: { posts: { orderBy: { created_at: "desc" }, take: 1 } },
          });

          if (stack) {
            await prisma.libraryPost.create({
              // NOTE: LibraryPost has no source linkage in the current schema
              // (no sourceId/order/createdById columns). We associate it with
              // the stack and uploader; source linkage tracked via title.
              data: {
                stack_id: body.stackId,
                uploader_id: BigInt(userId),
                title: source.title ?? undefined,
              } as any,
            });
          }
        }

        results.imported++;
        results.sources.push({
          id: source.id,
          title: source.title || "Untitled",
          created: true,
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          title: searchResult.title,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Bulk import failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
