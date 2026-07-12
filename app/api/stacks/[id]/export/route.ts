export const dynamic = "force-dynamic";

/**
 * GET /api/stacks/[id]/export
 * 
 * Phase 1.6 of Stacks Improvement Roadmap
 * 
 * Export a stack in various formats.
 * 
 * Query params:
 *   - format: "json" | "md" | "markdown" | "bib" | "bibtex"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { canViewStack } from "@/lib/stacks/permissions";
import { generateJSONExport } from "@/lib/stacks/export/json";
import { generateMarkdownExport } from "@/lib/stacks/export/markdown";
import { generateBibTeXExport } from "@/lib/stacks/export/bibtex";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stackId } = await params;
    const user = await getUserFromCookies();
    const userId = user?.userId ? BigInt(user.userId) : null;
    
    const format = req.nextUrl.searchParams.get("format") || "json";

    // Permission check
    const canView = await canViewStack(stackId, userId);
    if (!canView) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch stack with all data needed for export
    const stack = await prisma.stack.findUnique({
      where: { id: stackId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        visibility: true,
        is_public: true,
        created_at: true,
        owner: { 
          select: { 
            id: true, 
            name: true, 
            username: true 
          } 
        },
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            kind: true,
            position: true,
            note: true,
            createdAt: true,
            addedBy: { 
              select: { 
                name: true, 
                username: true 
              } 
            },
            block: {
              select: {
                id: true,
                blockType: true,
                title: true,
                file_url: true,
                page_count: true,
                created_at: true,
                // Link fields
                linkUrl: true,
                linkTitle: true,
                linkDescription: true,
                linkImage: true,
                linkSiteName: true,
                // Text fields
                textContent: true,
                textPlain: true,
                // Video fields
                videoUrl: true,
                videoProvider: true,
              },
            },
            embedStack: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!stack) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Prepare stack data with visibility fallback
    const stackData = {
      ...stack,
      visibility: stack.visibility ?? (stack.is_public ? "public_closed" : "private"),
    };

    // Generate filename base
    const filename = stack.slug || stack.id;

    switch (format.toLowerCase()) {
      case "md":
      case "markdown":
        const markdown = generateMarkdownExport(stackData as any);
        return new NextResponse(markdown, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.md"`,
          },
        });

      case "bib":
      case "bibtex":
        const bibtex = generateBibTeXExport(stackData as any);
        return new NextResponse(bibtex, {
          headers: {
            "Content-Type": "application/x-bibtex; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.bib"`,
          },
        });

      case "json":
      default:
        const json = generateJSONExport(stackData as any);
        return new NextResponse(JSON.stringify(json, null, 2), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.json"`,
          },
        });
    }
  } catch (error) {
    console.error("Error in GET /api/stacks/[id]/export:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
