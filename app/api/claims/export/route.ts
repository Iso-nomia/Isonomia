export const dynamic = "force-dynamic";

/**
 * Export Claims API
 *
 * Phase 3.2: Export Formats
 *
 * Exports claims in various academic formats:
 * - BibTeX (for LaTeX/academic papers)
 * - RIS (for reference managers like Zotero, Mendeley, EndNote)
 * - Markdown (for documentation/notes)
 * - PDF (returns HTML for client-side or server-side PDF conversion)
 * - JSON (raw structured data)
 *
 * Query Parameters:
 * - format: bibtex | ris | markdown | pdf | json (default: json)
 * - deliberationId: filter by deliberation
 * - claimIds: comma-separated list of specific claim IDs
 * - academicClaimType: filter by claim type
 * - includeSources: boolean (default: true)
 * - includeVersions: boolean (default: true)
 *
 * @route GET /api/claims/export
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  exportClaimsToBibTeX,
  exportClaimsToRIS,
  exportClaimsToMarkdown,
  generateClaimsPDFHtml,
  ExportableClaim,
  ExportableSource,
  getMimeType,
  generateExportFilename,
} from "@/lib/exports";

// Query parameter schema
const ExportQuerySchema = z.object({
  format: z
    .enum(["bibtex", "ris", "markdown", "pdf", "json"])
    .default("json"),
  deliberationId: z.string().optional(),
  claimIds: z.string().optional(), // Comma-separated IDs
  academicClaimType: z
    .enum([
      "thesis",
      "empirical",
      "causal",
      "methodological",
      "theoretical",
      "normative",
      "interpretive",
      "comparative",
      "predictive",
      "meta_analytical",
    ])
    .optional(),
  includeSources: z.coerce.boolean().default(true),
  includeVersions: z.coerce.boolean().default(true),
  limit: z.coerce.number().min(1).max(500).default(100),
  // Markdown-specific options
  includeTOC: z.coerce.boolean().default(true),
  includeFrontmatter: z.coerce.boolean().default(true),
  // PDF-specific options
  includeCover: z.coerce.boolean().default(true),
  paperSize: z.enum(["letter", "a4"]).default("letter"),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryParams = {
    format: url.searchParams.get("format") ?? undefined,
    deliberationId: url.searchParams.get("deliberationId") ?? undefined,
    claimIds: url.searchParams.get("claimIds") ?? undefined,
    academicClaimType: url.searchParams.get("academicClaimType") ?? undefined,
    includeSources: url.searchParams.get("includeSources") ?? undefined,
    includeVersions: url.searchParams.get("includeVersions") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    includeTOC: url.searchParams.get("includeTOC") ?? undefined,
    includeFrontmatter: url.searchParams.get("includeFrontmatter") ?? undefined,
    includeCover: url.searchParams.get("includeCover") ?? undefined,
    paperSize: url.searchParams.get("paperSize") ?? undefined,
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
    deliberationId,
    claimIds,
    academicClaimType,
    includeSources,
    includeVersions,
    limit,
    includeTOC,
    includeFrontmatter,
    includeCover,
    paperSize,
  } = parsed.data;

  // Build where clause
  const where: any = {};
  if (deliberationId) where.deliberationId = deliberationId;
  if (claimIds) where.id = { in: claimIds.split(",").map((id) => id.trim()) };
  if (academicClaimType) where.academicClaimType = academicClaimType;

  // Fetch claims with related data
  const claims = await prisma.claim.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      source: includeSources,
      deliberation: { select: { id: true, title: true } },
      versions: includeVersions
        ? {
            orderBy: { versionNumber: "desc" },
            take: 10,
          }
        : false,
    },
  });

  if (claims.length === 0) {
    return NextResponse.json(
      { error: "No claims found matching criteria" },
      { status: 404 }
    );
  }

  // Get author info using auth_id
  const authorAuthIds = [...new Set(claims.map((c) => c.createdById))];
  const authors = await prisma.user.findMany({
    where: { auth_id: { in: authorAuthIds } },
    select: { id: true, name: true, auth_id: true },
  });
  const authorMap = new Map(authors.map((a) => [a.auth_id, a]));

  // Transform claims to exportable format
  const exportableClaims: ExportableClaim[] = claims.map((claim) => {
    const author = authorMap.get(claim.createdById);
    return {
      id: claim.id,
      text: claim.text,
      claimType: claim.claimType,
      academicClaimType: claim.academicClaimType,
      consensusStatus: null,
      createdAt: claim.createdAt,
      author: author ? { id: String(author.id), name: author.name } : null,
      deliberationId: claim.deliberationId,
      deliberationTitle: (claim.deliberation as any)?.title ?? null,
      sources: claim.source
        ? [
            {
              id: claim.source.id,
              kind: claim.source.kind ?? "article",
              title: claim.source.title,
              authors: parseAuthors(claim.source.authorsJson),
              year: claim.source.year,
              doi: claim.source.doi,
              url: claim.source.url,
              container: claim.source.container,
              publisher: claim.source.publisher,
              volume: claim.source.volume,
              issue: claim.source.issue,
              pages: claim.source.pages,
            },
          ]
        : [],
      currentVersion: (claim.versions as any[])?.[0]?.versionNumber ?? 1,
      versionHistory: (claim.versions as any[])?.map((v: any) => {
        const vAuthor = authorMap.get(v.authorId);
        return {
          versionNumber: v.versionNumber,
          text: v.text,
          changeType: v.changeType,
          changeReason: v.changeReason,
          createdAt: v.createdAt,
          author: vAuthor ? { id: String(vAuthor.id), name: vAuthor.name } : null,
        };
      }),
    };
  });

  // Collect sources
  const exportableSources: ExportableSource[] = includeSources
    ? collectSources(exportableClaims)
    : [];

  // Determine title for filename
  const exportTitle = deliberationId
    ? (claims[0]?.deliberation as any)?.title ?? "claims"
    : `claims-${claims.length}`;

  // Generate export based on format
  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case "bibtex": {
      const result = exportClaimsToBibTeX(exportableClaims);
      content = result.content;
      contentType = getMimeType("bibtex");
      filename = generateExportFilename(exportTitle, "bibtex", true);
      break;
    }

    case "ris": {
      const result = exportClaimsToRIS(exportableClaims);
      content = result.content;
      contentType = getMimeType("ris");
      filename = generateExportFilename(exportTitle, "ris", true);
      break;
    }

    case "markdown": {
      const result = exportClaimsToMarkdown(exportableClaims, {
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

    case "pdf": {
      const result = generateClaimsPDFHtml(exportableClaims, {
        includeCover,
        includePageNumbers: true,
        paperSize,
        sections: ["abstract", "claims", "bibliography"],
      });
      content = result.content;
      contentType = "text/html";
      filename = generateExportFilename(exportTitle, "pdf", true).replace(
        ".pdf",
        ".html"
      );
      break;
    }

    case "json":
    default:
      content = JSON.stringify(
        {
          claims: exportableClaims,
          sources: exportableSources,
          meta: {
            count: exportableClaims.length,
            deliberationId: deliberationId ?? null,
            academicClaimType: academicClaimType ?? null,
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

function collectSources(claims: ExportableClaim[]): ExportableSource[] {
  const sourceMap = new Map<string, ExportableSource>();

  for (const claim of claims) {
    if (claim.sources) {
      for (const source of claim.sources) {
        if (!sourceMap.has(source.id)) {
          sourceMap.set(source.id, source);
        }
      }
    }
  }

  return Array.from(sourceMap.values());
}

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
