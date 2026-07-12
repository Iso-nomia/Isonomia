/**
 * Roadmap C.3 — GET /api/schemes/similar?key=&k=&searchBoundMs=
 *
 * Key-addressed redundancy radar backing the MCP
 * `find_behaviourally_similar_schemes` tool. Buckets the catalogue by the
 * target's fingerprint (necessary condition) then verifier-confirms each
 * candidate (authoritative). An empty hits list means "no behavioural
 * near-duplicate", not "not checked".
 */

import { NextRequest, NextResponse } from "next/server";
import { findBehaviourallySimilarSchemesByKey } from "@/lib/schemes/readTools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return NextResponse.json(
      { error: "bad-request", detail: "key query param is required" },
      { status: 400 },
    );
  }

  const kRaw = url.searchParams.get("k");
  let k = kRaw ? Number(kRaw) : 5;
  if (!Number.isFinite(k) || k <= 0) k = 5;
  k = Math.min(Math.floor(k), 25);

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

  const result = await findBehaviourallySimilarSchemesByKey(
    key,
    k,
    undefined,
    searchBoundMs,
  );
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
