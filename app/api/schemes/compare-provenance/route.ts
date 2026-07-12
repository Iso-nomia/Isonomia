/**
 * Roadmap D.2 — GET /api/schemes/compare-provenance?keyA=&keyB=&searchBoundMs=
 *
 * Key-addressed read surface backing the MCP `compare_scheme_provenance` tool.
 * Composes two D.1 provenance reads with the C.1 verifier to answer "same
 * scheme under two presentations?": source delta + behaviour-equality signal.
 */

import { NextRequest, NextResponse } from "next/server";
import { compareSchemeProvenanceByKeys } from "@/lib/schemes/provenanceTools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const keyA = url.searchParams.get("keyA");
  const keyB = url.searchParams.get("keyB");
  if (!keyA || !keyB) {
    return NextResponse.json(
      { error: "bad-request", detail: "keyA and keyB query params are required" },
      { status: 400 },
    );
  }

  const searchBoundRaw = url.searchParams.get("searchBoundMs");
  const searchBoundMs = searchBoundRaw ? Number(searchBoundRaw) : undefined;
  if (
    searchBoundMs !== undefined &&
    (!Number.isFinite(searchBoundMs) || searchBoundMs <= 0 || searchBoundMs > 60_000)
  ) {
    return NextResponse.json(
      { error: "bad-request", detail: "searchBoundMs must be 1..60000" },
      { status: 400 },
    );
  }

  const result = await compareSchemeProvenanceByKeys(
    keyA,
    keyB,
    searchBoundMs !== undefined ? { searchBoundMs } : undefined,
  );
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
