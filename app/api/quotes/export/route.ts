export const dynamic = "force-dynamic";

/**
 * Export Quotes API
 *
 * Phase 3.2: Export Formats
 *
 * Exports quotes/excerpts in various academic formats:
 * - BibTeX (for LaTeX/academic papers)
 * - RIS (for reference managers like Zotero, Mendeley, EndNote)
 * - Markdown (for documentation/notes)
 * - JSON (raw structured data)
 *
 * Query Parameters:
 * - format: bibtex | ris | markdown | json (default: json)
 * - quoteIds: comma-separated list of specific quote IDs
 * - sourceId: filter by source
 * - claimId: filter by linked claim
 *
 * @route GET /api/quotes/export
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  exportQuotesToBibTeX,
  exportQuotesToRIS,
  exportQuotesToMarkdown,
  ExportableQuote,
  getMimeType,
  generateExportFilename,
} from "@/lib/exports";

// Query parameter schema
const ExportQuerySchema = z.object({
  format: z.enum(["bibtex", "ris", "markdown", "json"]).default("json"),
  quoteIds: z.string().optional(), // Comma-separated IDs
  sourceId: z.string().optional(),
  claimId: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  // Markdown-specific options
  includeTOC: z.coerce.boolean().default(true),
  includeFrontmatter: z.coerce.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryParams = {
    format: url.searchParams.get("format") ?? undefined,
    quoteIds: url.searchParams.get("quoteIds") ?? undefined,
    sourceId: url.searchParams.get("sourceId") ?? undefined,
    claimId: url.searchParams.get("claimId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    includeTOC: url.searchParams.get("includeTOC") ?? undefined,
    includeFrontmatter: url.searchParams.get("includeFrontmatter") ?? undefined,
  };

  const parsed = ExportQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    format,
    quoteIds,
    sourceId,
    claimId,
    limit,
    includeTOC,
    includeFrontmatter,
  } = parsed.data;

  // Build where clause
  const where: any = {};
  if (quoteIds)
    where.id = { in: quoteIds.split(",").map((id) => id.trim()) };
  if (sourceId) where.sourceId = sourceId;
  if (claimId) {
    where.usedInClaims = { some: { claimId } };
  }

  // Fetch quotes with related data
  const quotes = await prisma.quoteNode.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      source: true,
    },
  });

  if (quotes.length === 0) {
    return NextResponse.json(
      { error: "No quotes found matching criteria" },
      { status: 404 }
    );
  }

  // Get author info using auth_id
  const authorAuthIds = [...new Set(quotes.map((q) => q.createdById).filter(Boolean))];
  const authors = authorAuthIds.length
    ? await prisma.user.findMany({
        where: { auth_id: { in: authorAuthIds as string[] } },
        select: { id: true, name: true, auth_id: true },
      })
    : [];
  const authorMap = new Map(authors.map((a) => [a.auth_id, a]));

  // Transform quotes to exportable format
  const exportableQuotes: ExportableQuote[] = quotes.map((quote) => {
    const author = quote.createdById ? authorMap.get(quote.createdById) : null;
    return {
      id: quote.id,
      text: quote.text,
      locator: quote.locator,
      locatorType: quote.locatorType,
      createdAt: quote.createdAt,
      author: author ? { id: String(author.id), name: author.name } : null,
      source: quote.source
        ? {
            id: quote.source.id,
            kind: quote.source.kind ?? "article",
            title: quote.source.title,
            authors: parseAuthors(quote.source.authorsJson),
            year: quote.source.year,
            doi: quote.source.doi,
            url: quote.source.url,
            container: quote.source.container,
            publisher: quote.source.publisher,
            volume: quote.source.volume,
            issue: quote.source.issue,
            pages: quote.source.pages,
          }
        : null,
    };
  });

  // Generate export based on format
  let content: string;
  let contentType: string;
  let filename: string;

  const exportTitle = `quotes-${quotes.length}`;

  switch (format) {
    case "bibtex": {
      const result = exportQuotesToBibTeX(exportableQuotes);
      content = result.content;
      contentType = getMimeType("bibtex");
      filename = generateExportFilename(exportTitle, "bibtex", true);
      break;
    }

    case "ris": {
      const result = exportQuotesToRIS(exportableQuotes);
      content = result.content;
      contentType = getMimeType("ris");
      filename = generateExportFilename(exportTitle, "ris", true);
      break;
    }

    case "markdown": {
      const result = exportQuotesToMarkdown(exportableQuotes, {
        includeTOC,
        includeFrontmatter,
        startHeadingLevel: 1,
        includeSectionDividers: true,
        linkStyle: "reference",
        includeDiagrams: false,
      });
      content = result.content;
      contentType = getMimeType("markdown");
      filename = generateExportFilename(exportTitle, "markdown", true);
      break;
    }

    case "json":
    default:
      content = JSON.stringify(
        {
          quotes: exportableQuotes,
          meta: {
            count: exportableQuotes.length,
            sourceId: sourceId ?? null,
            claimId: claimId ?? null,
          },
          exportedAt: new Date().toISOString(),
          format: "mesh-export-v1",
        },
        null,
        2
      );
      contentType = "application/json";
      filename = generateExportFilename(exportTitle, "json", true);
      break;
  }

  // Return response with appropriate headers
  const headers: HeadersInit = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  return new NextResponse(content, { headers });
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

function parseAuthors(
  authors: any
): Array<{ family?: string; given?: string }> {
  if (!authors) return [];
  if (Array.isArray(authors)) {
    return authors.map((a) => {
      if (typeof a === "string") {
        const parts = a.split(" ");
        return {
          family: parts[parts.length - 1],
          given: parts.slice(0, -1).join(" "),
        };
      }
      return { family: a.family, given: a.given };
    });
  }
  if (typeof authors === "string") {
    return authors.split(",").map((name) => {
      const parts = name.trim().split(" ");
      return {
        family: parts[parts.length - 1],
        given: parts.slice(0, -1).join(" "),
      };
    });
  }
  return [];
}
