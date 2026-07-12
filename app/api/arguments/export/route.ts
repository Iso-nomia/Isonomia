export const dynamic = "force-dynamic";

/**
 * Export Arguments API
 *
 * Phase 3.2: Export Formats
 *
 * Exports arguments in various academic formats:
 * - BibTeX (for LaTeX/academic papers)
 * - RIS (for reference managers like Zotero, Mendeley, EndNote)
 * - Markdown (for documentation/notes)
 * - PDF (returns HTML for client-side or server-side PDF conversion)
 * - JSON (raw structured data)
 *
 * Query Parameters:
 * - format: bibtex | ris | markdown | pdf | json (default: json)
 * - deliberationId: filter by deliberation
 * - argumentIds: comma-separated list of specific argument IDs
 * - schemeId: filter by argumentation scheme
 * - includePremises: boolean (default: true)
 * - includeConclusion: boolean (default: true)
 *
 * @route GET /api/arguments/export
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  exportArgumentsToBibTeX,
  exportArgumentsToRIS,
  exportArgumentsToMarkdown,
  generateArgumentsPDFHtml,
  ExportableArgument,
  getMimeType,
  generateExportFilename,
} from "@/lib/exports";

// Query parameter schema
const ExportQuerySchema = z.object({
  format: z
    .enum(["bibtex", "ris", "markdown", "pdf", "json"])
    .default("json"),
  deliberationId: z.string().optional(),
  argumentIds: z.string().optional(), // Comma-separated IDs
  schemeId: z.string().optional(),
  includePremises: z.coerce.boolean().default(true),
  includeConclusion: z.coerce.boolean().default(true),
  limit: z.coerce.number().min(1).max(500).default(100),
  // Markdown-specific options
  includeTOC: z.coerce.boolean().default(true),
  includeFrontmatter: z.coerce.boolean().default(true),
  includeDiagrams: z.coerce.boolean().default(true),
  // PDF-specific options
  includeCover: z.coerce.boolean().default(true),
  paperSize: z.enum(["letter", "a4"]).default("letter"),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryParams = {
    format: url.searchParams.get("format") ?? undefined,
    deliberationId: url.searchParams.get("deliberationId") ?? undefined,
    argumentIds: url.searchParams.get("argumentIds") ?? undefined,
    schemeId: url.searchParams.get("schemeId") ?? undefined,
    includePremises: url.searchParams.get("includePremises") ?? undefined,
    includeConclusion: url.searchParams.get("includeConclusion") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
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
    deliberationId,
    argumentIds,
    schemeId,
    includePremises,
    includeConclusion,
    limit,
    includeTOC,
    includeFrontmatter,
    includeDiagrams,
    includeCover,
    paperSize,
  } = parsed.data;

  // Build where clause
  const where: any = {};
  if (deliberationId) where.deliberationId = deliberationId;
  if (argumentIds)
    where.id = { in: argumentIds.split(",").map((id) => id.trim()) };
  if (schemeId) where.schemeId = schemeId;

  // Fetch arguments with related data
  const args = await prisma.argument.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      scheme: true,
      deliberation: { select: { id: true, title: true } },
      premises: includePremises
        ? {
            include: {
              claim: { select: { id: true, text: true } },
            },
          }
        : false,
      conclusion: includeConclusion
        ? { select: { id: true, text: true } }
        : false,
    },
  });

  if (args.length === 0) {
    return NextResponse.json(
      { error: "No arguments found matching criteria" },
      { status: 404 }
    );
  }

  // Get author info using auth_id
  const authorAuthIds = [...new Set(args.map((a) => a.authorId))];
  const authors = await prisma.user.findMany({
    where: { auth_id: { in: authorAuthIds } },
    select: { id: true, name: true, auth_id: true },
  });
  const authorMap = new Map(authors.map((a) => [a.auth_id, a]));

  // Transform arguments to exportable format
  const exportableArguments: ExportableArgument[] = args.map((arg) => {
    const author = authorMap.get(arg.authorId);
    return {
      id: arg.id,
      text: arg.text,
      argumentType: (arg as any).type ?? null,
      schemeId: arg.schemeId,
      schemeName: (arg.scheme as any)?.name ?? null,
      createdAt: arg.createdAt,
      author: author ? { id: String(author.id), name: author.name } : null,
      deliberationId: arg.deliberationId,
      deliberationTitle: (arg.deliberation as any)?.title ?? null,
      premises: includePremises
        ? (arg.premises as any[])?.map((p: any) => ({
            id: p.claim?.id ?? p.id,
            text: p.claim?.text ?? p.text ?? "",
          }))
        : undefined,
      conclusion:
        includeConclusion && arg.conclusion
          ? {
              id: (arg.conclusion as any).id,
              text: (arg.conclusion as any).text,
            }
          : null,
    };
  });

  // Determine title for filename
  const exportTitle = deliberationId
    ? (args[0]?.deliberation as any)?.title ?? "arguments"
    : `arguments-${args.length}`;

  // Generate export based on format
  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case "bibtex": {
      const result = exportArgumentsToBibTeX(exportableArguments);
      content = result.content;
      contentType = getMimeType("bibtex");
      filename = generateExportFilename(exportTitle, "bibtex", true);
      break;
    }

    case "ris": {
      const result = exportArgumentsToRIS(exportableArguments);
      content = result.content;
      contentType = getMimeType("ris");
      filename = generateExportFilename(exportTitle, "ris", true);
      break;
    }

    case "markdown": {
      const result = exportArgumentsToMarkdown(exportableArguments, {
        includeTOC,
        includeFrontmatter,
        startHeadingLevel: 1,
        includeSectionDividers: true,
        linkStyle: "reference",
        includeDiagrams,
      });
      content = result.content;
      contentType = getMimeType("markdown");
      filename = generateExportFilename(exportTitle, "markdown", true);
      break;
    }

    case "pdf": {
      const result = generateArgumentsPDFHtml(exportableArguments, {
        includeCover,
        includePageNumbers: true,
        paperSize,
        sections: ["abstract", "arguments"],
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
          arguments: exportableArguments,
          meta: {
            count: exportableArguments.length,
            deliberationId: deliberationId ?? null,
            schemeId: schemeId ?? null,
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
