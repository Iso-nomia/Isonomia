export const dynamic = "force-dynamic";

/**
 * AIF Export API Route (by schemeKey)
 * GET /api/aif/export/key/:schemeKey
 */

import { NextRequest, NextResponse } from "next/server";
import { exportSchemeByKey } from "@/lib/aif/aifExporter";
import { AIFExportFormat } from "@/lib/aif/ontologyTypes";
import { FORMAT_TO_MIME_TYPE } from "@/lib/aif/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeKey: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    
    const format = (searchParams.get("format") || "turtle") as AIFExportFormat;
    const includeHierarchy = searchParams.get("includeHierarchy") !== "false";
    const includeCQs = searchParams.get("includeCQs") !== "false";
    const download = searchParams.get("download") === "true";
    
    if (!["rdfxml", "turtle", "jsonld"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be rdfxml, turtle, or jsonld" },
        { status: 400 }
      );
    }

    const result = await exportSchemeByKey(params.schemeKey, {
      format,
      includeHierarchy,
      includeCQs,
      includeInheritedCQs: true,
      includeMetadata: true,
      includeMeshExtensions: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message || "Export failed" },
        { status: result.error?.code === "SCHEME_NOT_FOUND" ? 404 : 500 }
      );
    }

    const extensions = {
      rdfxml: "rdf",
      turtle: "ttl",
      jsonld: "jsonld",
    };
    const ext = extensions[format];

    const headers: Record<string, string> = {
      "Content-Type": FORMAT_TO_MIME_TYPE[format],
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${params.schemeKey}.${ext}"`;
    }

    return new NextResponse(result.data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("AIF export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
