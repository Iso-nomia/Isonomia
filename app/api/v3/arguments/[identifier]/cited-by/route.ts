/**
 * Phase 10a — Cited-by for an argument (spec: docs/Phase10a_CitedBy_Spec.md §4a).
 *
 * GET /api/v3/arguments/{identifier}/cited-by
 *   → { target, edges: CitedByEdge[], counts, truncated, links }
 *
 * "Cited-by" is *who points at / uses this argument* (support edges, attacks,
 * premise-usage, cross-room reuse) — distinct from `/stances` (*who concludes
 * for/against a claim*). Attacks are surfaced at `counts.contests` so no
 * consumer can read cited-by as pure applause. Honest-empty is a 200 with
 * `counts.total: 0`, never an error. Missing argument → 404.
 *
 * All shaping lives in lib/citation/citedBy.ts; this handler only resolves the
 * permalink, maps null → 404, and wraps the standard envelope.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import {
  getArgumentCitedBy,
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
  ctx: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  const sort = sp.get("sort") === "stance" ? "stance" : "recent";
  const publicOnly = parseBool(sp.get("public_only"));
  const includeStanding = parseBool(sp.get("include_standing"));

  const resolved = await resolvePermalink(identifier);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "argument_not_found", identifier },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const result = await getArgumentCitedBy(resolved.argumentId, {
    limit,
    sort,
    publicOnly,
    includeStanding,
  });
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "argument_not_found", identifier },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const links: Record<string, string> = {
    self: `${BASE_URL}/a/${result.target.shortCode ?? identifier}`,
  };
  if (result.target.conclusionMoid) {
    links.counterSearch = `${BASE_URL}/search/arguments?against=${encodeURIComponent(
      result.target.conclusionMoid,
    )}`;
  }

  return NextResponse.json(
    {
      ok: true,
      query: { identifier, limit, sort, publicOnly, includeStanding },
      target: result.target,
      edges: result.edges,
      counts: result.counts,
      truncated: result.truncated,
      links,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
