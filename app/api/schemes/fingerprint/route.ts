/**
 * Roadmap C.2 — GET /api/schemes/fingerprint?key=
 *
 * Key-addressed read surface backing the MCP `compute_scheme_fingerprint` tool.
 * Returns the materialised behaviour fingerprint (recomputed if the column is
 * null), framed as a structural pre-filter — not a proof of equality.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeSchemeFingerprintByKey } from "@/lib/schemes/readTools";

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
  const result = await computeSchemeFingerprintByKey(key);
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
