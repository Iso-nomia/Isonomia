export const dynamic = "force-dynamic";

// app/api/thesis/[id]/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { exportThesis } from "@/lib/thesis/export-renderer";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserAuthId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "html";
    const includeMetadata = searchParams.get("metadata") !== "false";
    const includeStyles = searchParams.get("styles") !== "false";
    const expandObjects = searchParams.get("expand") === "true";
    const download = searchParams.get("download") === "true";

    // Validate format
    if (!["html", "markdown", "json"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use: html, markdown, or json" }, { status: 400, ...NO_STORE });
    }

    // Export thesis
    const exported = await exportThesis(params.id, {
      format: format as "html" | "markdown" | "json",
      includeMetadata,
      includeStyles,
      expandObjects,
    });

    // Determine content and filename
    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case "html":
        content = exported.html || "";
        contentType = "text/html";
        extension = "html";
        break;
      case "markdown":
        content = exported.markdown || "";
        contentType = "text/markdown";
        extension = "md";
        break;
      case "json":
        content = exported.json || "";
        contentType = "application/json";
        extension = "json";
        break;
      default:
        content = exported.html || "";
        contentType = "text/html";
        extension = "html";
    }

    // Generate filename from thesis title
    const filename = `${exported.metadata.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${extension}`;

    // Return as download or inline
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    return new NextResponse(content, { headers });
  } catch (err: any) {
    console.error("[thesis/:id/export GET] failed", err);
    return NextResponse.json({ error: err?.message ?? "Export failed" }, { status: 500, ...NO_STORE });
  }
}
