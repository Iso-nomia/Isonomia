/**
 * Phase 10a — Cited-by for a claim (spec: docs/Phase10a_CitedBy_Spec.md §4b).
 *
 * GET /api/v3/claims/{moid}/cited-by
 *   → { target, edges: CitedByEdge[], counts, truncated, links }
 *
 * Claim cited-by is *who uses/points at this claim* — arguments that use it as
 * a premise (`builds-on`) and arguments/conflicts that attack it (`contests`).
 * It deliberately omits arguments that *conclude* the claim (that is
 * `/stances` — producing, not citing), and the `links.stances` pointer routes
 * a consumer wanting for/against to the right endpoint. Missing claim → 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  getClaimCitedBy,
  CITED_BY_DEFAULT_LIMIT,
  CITED_BY_MAX_LIMIT,
} from "@/lib/citation/citedBy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function parseLimit(raw: string | null): number {
  if (!raw) return CITED_BY_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return CITED_BY_DEFAULT_LIMIT;
  return Math.min(CITED_BY_MAX_LIMIT, Math.floor(n));
}

function parseBool(raw: string | null): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ moid: string }> },
) {
  const { moid } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  const sort = sp.get("sort") === "stance" ? "stance" : "recent";
  const publicOnly = parseBool(sp.get("public_only"));
  const includeStanding = parseBool(sp.get("include_standing"));

  const claim = await prisma.claim.findFirst({
    where: { moid },
    select: { id: true },
  });
  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "claim_not_found", moid },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const result = await getClaimCitedBy(claim.id, {
    limit,
    sort,
    publicOnly,
    includeStanding,
  });
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "claim_not_found", moid },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      query: { moid, limit, sort, publicOnly, includeStanding },
      target: result.target,
      edges: result.edges,
      counts: result.counts,
      truncated: result.truncated,
      links: {
        self: `${BASE_URL}/c/${encodeURIComponent(moid)}`,
        stances: `${BASE_URL}/api/v3/claims/${encodeURIComponent(moid)}/stances`,
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
