export const dynamic = "force-dynamic";

/**
 * AIF Export API Route
 * GET /api/aif/export/:schemeId or /api/aif/export/key/:schemeKey
 * 
 * Query parameters:
 * - format: rdfxml | turtle | jsonld (default: turtle)
 * - includeHierarchy: boolean (default: true)
 * - includeCQs: boolean (default: true)
 * - download: boolean (default: false) - if true, set Content-Disposition header
 */

import { NextRequest, NextResponse } from "next/server";
import { exportSchemeToAIF, exportSchemeByKey } from "@/lib/aif/aifExporter";
import { AIFExportFormat } from "@/lib/aif/ontologyTypes";
import { FORMAT_TO_MIME_TYPE } from "@/lib/aif/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse options from query parameters
    const format = (searchParams.get("format") || "turtle") as AIFExportFormat;
    const includeHierarchy = searchParams.get("includeHierarchy") !== "false";
    const includeCQs = searchParams.get("includeCQs") !== "false";
    const download = searchParams.get("download") === "true";
    
    // Validate format
    if (!["rdfxml", "turtle", "jsonld"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be rdfxml, turtle, or jsonld" },
        { status: 400 }
      );
    }

    // Export scheme
    const result = await exportSchemeToAIF(params.schemeId, {
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

    // Determine file extension
    const extensions = {
      rdfxml: "rdf",
      turtle: "ttl",
      jsonld: "jsonld",
    };
    const ext = extensions[format];

    // Set headers
    const headers: Record<string, string> = {
      "Content-Type": FORMAT_TO_MIME_TYPE[format],
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="scheme_${params.schemeId}.${ext}"`;
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
