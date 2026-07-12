/**
 * Phase 6 — Stance retrieval (Track C.2).
 *
 * GET /api/v3/claims/{moid}/stances
 *   → { for: [...arguments concluding to claim],
 *       against: [...arguments contesting claim] }
 *
 * "for"     stance: arguments whose conclusion MOID === target.
 * "against" stance: structural contesters (rebut/undercut edges +
 *                   conflict applications), self-counters excluded.
 *
 * Both lists are produced by delegating to GET /api/v3/search/arguments
 * (which owns all result-shaping: standingState, dialecticalFitness,
 * attestationUrl, hybrid block, lexicalCoverage, strongestCounter).
 * "for" uses `?conclusion_moid={moid}`, "against" uses `?against={moid}`.
 *
 * Honest-empty: when nothing is on file for a side, that side is `[]`.
 * Missing claim → 404 with `error: "claim_not_found"`.
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as searchGET } from "@/app/api/v3/search/arguments/route";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function parseBool(raw: string | null): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function callSearch(qs: URLSearchParams): Promise<any> {
  const url = `http://localhost/api/v3/search/arguments?${qs.toString()}`;
  const res = await searchGET(new NextRequest(url));
  return await res.json();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ moid: string }> },
) {
  const { moid } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  const sortRaw = (sp.get("sort") ?? "dialectical_fitness").toLowerCase();
  const sort =
    sortRaw === "recent" || sortRaw === "dialectical_fitness"
      ? sortRaw
      : "dialectical_fitness";
  const includeStrongestCounter = parseBool(sp.get("include_strongest_counter"));

  // Resolve the claim once so a missing MOID is an honest 404 rather
  // than two empty lists with no explanation.
  const claim = await prisma.claim.findFirst({
    where: { moid },
    select: { moid: true, text: true },
  });

  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "claim_not_found", moid },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  function commonParams(): URLSearchParams {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("sort", sort);
    if (includeStrongestCounter) p.set("include_strongest_counter", "1");
    return p;
  }

  const [forBody, againstBody] = await Promise.all([
    (async () => {
      const p = commonParams();
      p.set("conclusion_moid", claim.moid);
      return await callSearch(p);
    })(),
    (async () => {
      const p = commonParams();
      p.set("against", claim.moid);
      return await callSearch(p);
    })(),
  ]);

  const forResults = Array.isArray(forBody?.results) ? forBody.results : [];
  const againstResults = Array.isArray(againstBody?.results) ? againstBody.results : [];

  return NextResponse.json(
    {
      ok: true,
      query: {
        moid: claim.moid,
        limit,
        sort,
        includeStrongestCounter: includeStrongestCounter || undefined,
      },
      claim: { moid: claim.moid, text: claim.text },
      for: forResults,
      against: againstResults,
      counts: {
        for: forResults.length,
        against: againstResults.length,
      },
      links: {
        forSearch: `${BASE_URL}/search/arguments?conclusion_moid=${encodeURIComponent(claim.moid)}`,
        againstSearch: `${BASE_URL}/search/arguments?against=${encodeURIComponent(claim.moid)}`,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
