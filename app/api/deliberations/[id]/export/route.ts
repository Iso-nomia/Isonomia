export const dynamic = "force-dynamic";

/**
 * Export Deliberation API
 *
 * Phase 3.2: Export Formats
 *
 * Exports a deliberation and its contents in various academic formats:
 * - BibTeX (for LaTeX/academic papers)
 * - RIS (for reference managers like Zotero, Mendeley, EndNote)
 * - Markdown (for documentation/notes)
 * - PDF (returns HTML for client-side or server-side PDF conversion)
 * - JSON (raw structured data)
 *
 * Query Parameters:
 * - format: bibtex | ris | markdown | pdf | json (default: json)
 * - includeArguments: boolean (default: true)
 * - includeClaims: boolean (default: true)
 * - includeSources: boolean (default: true)
 *
 * @route GET /api/deliberations/[id]/export
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";
import {
  exportDeliberationToBibTeX,
  exportDeliberationToRIS,
  exportDeliberationToMarkdown,
  generateDeliberationPDFHtml,
  exportClaimsToBibTeX,
  exportClaimsToRIS,
  exportArgumentsToBibTeX,
  exportArgumentsToRIS,
  ExportableDeliberation,
  ExportableClaim,
  ExportableArgument,
  ExportableSource,
  getMimeType,
  generateExportFilename,
} from "@/lib/exports";

// Query parameter schema
const ExportQuerySchema = z.object({
  format: z
    .enum(["bibtex", "ris", "markdown", "pdf", "json"])
    .default("json"),
  includeArguments: z.coerce.boolean().default(true),
  includeClaims: z.coerce.boolean().default(true),
  includeSources: z.coerce.boolean().default(true),
  // Markdown-specific options
  includeTOC: z.coerce.boolean().default(true),
  includeFrontmatter: z.coerce.boolean().default(true),
  includeDiagrams: z.coerce.boolean().default(false),
  // PDF-specific options
  includeCover: z.coerce.boolean().default(true),
  paperSize: z.enum(["letter", "a4"]).default("letter"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const queryParams = {
    format: url.searchParams.get("format") ?? undefined,
    includeArguments: url.searchParams.get("includeArguments") ?? undefined,
    includeClaims: url.searchParams.get("includeClaims") ?? undefined,
    includeSources: url.searchParams.get("includeSources") ?? undefined,
    includeTOC: url.searchParams.get("includeTOC") ?? undefined,
    includeFrontmatter: url.searchParams.get("includeFrontmatter") ?? undefined,
    includeDiagrams: url.searchParams.get("includeDiagrams") ?? undefined,
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
    includeArguments,
    includeClaims,
    includeSources,
    includeTOC,
    includeFrontmatter,
    includeDiagrams,
    includeCover,
    paperSize,
  } = parsed.data;

  // Fetch deliberation with related data
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: params.id },
    include: {
      Claim: includeClaims
        ? {
            include: {
              source: true,
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 10,
              },
            },
          }
        : false,
      arguments: includeArguments
        ? {
            include: {
              premises: {
                include: {
                  claim: true,
                },
              },
              conclusion: true,
              scheme: true,
            },
          }
        : false,
    },
  });

  if (!deliberation) {
    return NextResponse.json(
      { error: "Deliberation not found" },
      { status: 404 }
    );
  }

  // Get author info using auth_id (createdById is auth_id string)
  const author = deliberation.createdById
    ? await prisma.user.findFirst({
        where: { auth_id: deliberation.createdById },
        select: { id: true, name: true },
      })
    : null;

  // Transform to exportable format
  const exportableDeliberation: ExportableDeliberation = {
    id: deliberation.id,
    title: resolveDeliberationName(deliberation, { fallback: "Untitled Deliberation" }),
    description: null,
    createdAt: deliberation.createdAt,
    updatedAt: deliberation.updatedAt,
    author: author ? { id: String(author.id), name: author.name } : null,
    claimCount: includeClaims
      ? (deliberation.Claim as any[])?.length ?? 0
      : undefined,
    argumentCount: includeArguments
      ? (deliberation.arguments as any[])?.length ?? 0
      : undefined,
  };

  // Transform claims
  const exportableClaims: ExportableClaim[] = includeClaims
    ? await transformClaims(deliberation.Claim as any[], deliberation.title)
    : [];

  // Transform arguments
  const exportableArguments: ExportableArgument[] = includeArguments
    ? await transformArguments(
        deliberation.arguments as any[],
        deliberation.title
      )
    : [];

  // Collect sources from claims
  const exportableSources: ExportableSource[] = includeSources
    ? collectSources(exportableClaims)
    : [];

  // Generate export based on format
  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case "bibtex": {
      // Export deliberation, claims, and arguments
      const delibResult = exportDeliberationToBibTeX(exportableDeliberation);
      const claimsResult = exportableClaims.length > 0
        ? exportClaimsToBibTeX(exportableClaims)
        : null;
      const argsResult = exportableArguments.length > 0
        ? exportArgumentsToBibTeX(exportableArguments)
        : null;

      // Combine all BibTeX content
      const parts = [delibResult.content];
      if (claimsResult) parts.push(claimsResult.content);
      if (argsResult) parts.push(argsResult.content);
      content = parts.join("\n\n");

      contentType = getMimeType("bibtex");
      filename = generateExportFilename(exportableDeliberation.title, "bibtex", true);
      break;
    }

    case "ris": {
      // Export deliberation, claims, and arguments
      const delibResult = exportDeliberationToRIS(exportableDeliberation);
      const claimsResult = exportableClaims.length > 0
        ? exportClaimsToRIS(exportableClaims)
        : null;
      const argsResult = exportableArguments.length > 0
        ? exportArgumentsToRIS(exportableArguments)
        : null;

      // Combine all RIS content
      const parts = [delibResult.content];
      if (claimsResult) parts.push(claimsResult.content);
      if (argsResult) parts.push(argsResult.content);
      content = parts.join("\n\n");

      contentType = getMimeType("ris");
      filename = generateExportFilename(exportableDeliberation.title, "ris", true);
      break;
    }

    case "markdown": {
      const result = exportDeliberationToMarkdown(
        exportableDeliberation,
        exportableClaims,
        exportableArguments,
        {
          includeTOC,
          includeFrontmatter,
          includeDiagrams,
          startHeadingLevel: 1,
          includeSectionDividers: true,
          linkStyle: "reference",
        }
      );
      content = result.content;
      contentType = getMimeType("markdown");
      filename = generateExportFilename(exportableDeliberation.title, "markdown", true);
      break;
    }

    case "pdf": {
      const result = generateDeliberationPDFHtml(
        exportableDeliberation,
        exportableClaims,
        exportableArguments,
        exportableSources,
        {
          includeCover,
          includePageNumbers: true,
          paperSize,
          sections: [
            "abstract",
            "claims",
            "arguments",
            "timeline",
            "bibliography",
          ],
        }
      );
      content = result.content;
      contentType = "text/html";
      filename = generateExportFilename(
        exportableDeliberation.title,
        "pdf",
        true
      ).replace(".pdf", ".html");
      break;
    }

    case "json":
    default:
      content = JSON.stringify(
        {
          deliberation: exportableDeliberation,
          claims: exportableClaims,
          arguments: exportableArguments,
          sources: exportableSources,
          exportedAt: new Date().toISOString(),
          format: "mesh-export-v1",
        },
        null,
        2
      );
      contentType = "application/json";
      filename = generateExportFilename(exportableDeliberation.title, "json", true);
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

async function transformClaims(
  claims: any[],
  deliberationTitle: string | null
): Promise<ExportableClaim[]> {
  if (!claims) return [];

  const authorAuthIds = [...new Set(claims.map((c) => c.createdById))];
  const authors = await prisma.user.findMany({
    where: { auth_id: { in: authorAuthIds } },
    select: { id: true, name: true, auth_id: true },
  });
  const authorMap = new Map(authors.map((a) => [a.auth_id, a]));

  return claims.map((claim) => {
    const author = authorMap.get(claim.createdById);
    return {
      id: claim.id,
      text: claim.text,
      claimType: claim.claimType,
      academicClaimType: claim.academicClaimType,
      consensusStatus: null,
      createdAt: claim.createdAt,
      author: author ? { id: String(author.id), name: author.name } : null,
      deliberationTitle,
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
      currentVersion: claim.versions?.[0]?.versionNumber ?? 1,
      versionHistory: claim.versions?.map((v: any) => {
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
}

async function transformArguments(
  args: any[],
  deliberationTitle: string | null
): Promise<ExportableArgument[]> {
  if (!args) return [];

  const authorAuthIds = [...new Set(args.map((a) => a.authorId))];
  const authors = await prisma.user.findMany({
    where: { auth_id: { in: authorAuthIds } },
    select: { id: true, name: true, auth_id: true },
  });
  const authorMap = new Map(authors.map((a) => [a.auth_id, a]));

  return args.map((arg) => {
    const author = authorMap.get(arg.authorId);
    return {
      id: arg.id,
      text: arg.text,
      argumentType: arg.type ?? null,
      schemeId: arg.schemeId,
      schemeName: arg.scheme?.name ?? null,
      createdAt: arg.createdAt,
      author: author ? { id: String(author.id), name: author.name } : null,
      deliberationTitle,
      premises: arg.premises?.map((p: any) => ({
        id: p.claim?.id ?? p.id,
        text: p.claim?.text ?? p.text ?? "",
      })),
      conclusion: arg.conclusion
        ? {
            id: arg.conclusion.id,
            text: arg.conclusion.text,
          }
        : null,
    };
  });
}

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
