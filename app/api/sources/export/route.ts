export const dynamic = "force-dynamic";

/**
 * Export Sources API
 *
 * Phase 3.2: Export Formats
 *
 * Exports sources/references in various academic formats:
 * - BibTeX (for LaTeX/academic papers)
 * - RIS (for reference managers like Zotero, Mendeley, EndNote)
 * - Markdown (for documentation/notes)
 * - JSON (raw structured data)
 *
 * Query Parameters:
 * - format: bibtex | ris | markdown | json (default: json)
 * - sourceIds: comma-separated list of specific source IDs
 * - kind: filter by source type (article, book, chapter, etc.)
 * - hasDoI: filter sources with DOI
 *
 * @route GET /api/sources/export
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  exportSourcesToBibTeX,
  exportSourcesToRIS,
  exportSourcesToMarkdown,
  ExportableSource,
  getMimeType,
  generateExportFilename,
} from "@/lib/exports";

// Query parameter schema
const ExportQuerySchema = z.object({
  format: z.enum(["bibtex", "ris", "markdown", "json"]).default("json"),
  sourceIds: z.string().optional(), // Comma-separated IDs
  kind: z.string().optional(),
  hasDoi: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  // Markdown-specific options
  includeTOC: z.coerce.boolean().default(true),
  includeFrontmatter: z.coerce.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryParams = {
    format: url.searchParams.get("format") ?? undefined,
    sourceIds: url.searchParams.get("sourceIds") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
    hasDoi: url.searchParams.get("hasDoi") ?? undefined,
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
    sourceIds,
    kind,
    hasDoi,
    limit,
    includeTOC,
    includeFrontmatter,
  } = parsed.data;

  // Build where clause
  const where: any = {};
  if (sourceIds)
    where.id = { in: sourceIds.split(",").map((id) => id.trim()) };
  if (kind) where.kind = kind;
  if (hasDoi !== undefined) {
    where.doi = hasDoi ? { not: null } : null;
  }

  // Fetch sources
  const sources = await prisma.source.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No sources found matching criteria" },
      { status: 404 }
    );
  }

  // Transform sources to exportable format
  const exportableSources: ExportableSource[] = sources.map((source) => ({
    id: source.id,
    kind: source.kind ?? "article",
    title: source.title,
    authors: parseAuthors(source.authorsJson),
    year: source.year,
    doi: source.doi,
    url: source.url,
    container: source.container,
    publisher: source.publisher,
    volume: source.volume,
    issue: source.issue,
    pages: source.pages,
  }));

  // Generate export based on format
  let content: string;
  let contentType: string;
  let filename: string;

  const exportTitle = `sources-${sources.length}`;

  switch (format) {
    case "bibtex": {
      const result = exportSourcesToBibTeX(exportableSources);
      content = result.content;
      contentType = getMimeType("bibtex");
      filename = generateExportFilename(exportTitle, "bibtex", true);
      break;
    }

    case "ris": {
      const result = exportSourcesToRIS(exportableSources);
      content = result.content;
      contentType = getMimeType("ris");
      filename = generateExportFilename(exportTitle, "ris", true);
      break;
    }

    case "markdown": {
      const result = exportSourcesToMarkdown(exportableSources, {
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
          sources: exportableSources,
          meta: {
            count: exportableSources.length,
            kind: kind ?? null,
            hasDoi: hasDoi ?? null,
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
