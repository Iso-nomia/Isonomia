export const dynamic = "force-dynamic";

/**
 * CV export endpoint
 * POST - generate a new export
 * GET - list previous exports
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import { generateCvExport, getUserExports } from "@/lib/credit/cvExportService";

const ExportSchema = z.object({
  format: z.enum(["JSON_LD", "BIBTEX", "WORD", "PDF", "LATEX", "CSV"]),
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  includeTypes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const options = ExportSchema.parse(body);

    const result = await generateCvExport(dbUser.id, {
      format: options.format,
      dateRange: options.dateRange
        ? {
            start: new Date(options.dateRange.start),
            end: new Date(options.dateRange.end),
          }
        : undefined,
      includeTypes: options.includeTypes,
    });

    // Return as downloadable file
    return new NextResponse(result.formatted, {
      headers: {
        "Content-Type": getContentType(options.format),
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const exports = await getUserExports(dbUser.id, limit);

    return NextResponse.json(exports);
  } catch (error) {
    console.error("Error listing exports:", error);
    return NextResponse.json(
      { error: "Failed to list exports" },
      { status: 500 }
    );
  }
}

function getContentType(format: string): string {
  const types: Record<string, string> = {
    JSON_LD: "application/ld+json",
    BIBTEX: "application/x-bibtex",
    LATEX: "application/x-latex",
    CSV: "text/csv",
    WORD: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    PDF: "application/pdf",
  };
  return types[format] || "text/plain";
}
