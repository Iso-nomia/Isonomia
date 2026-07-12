/**
 * Roadmap D.1 — GET /api/schemes/provenance?key=
 *
 * Key-addressed read surface backing the MCP `get_scheme_provenance` tool.
 * Echoes the shipped Q-022 provenance + Q-024 audit columns verbatim — no
 * derivation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSchemeProvenanceByKey } from "@/lib/schemes/provenanceTools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json(
      { error: "bad-request", detail: "key query param is required" },
      { status: 400 },
    );
  }
  const result = await getSchemeProvenanceByKey(key);
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
