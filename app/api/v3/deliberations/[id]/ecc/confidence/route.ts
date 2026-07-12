/**
 * GET /api/v3/deliberations/[id]/ecc/confidence?claimId=...&mode=min|product|logodds
 *
 * Sprint E1 — `c: Hom(I, claim) → ℳ` evaluated under the requested
 * monoid (Ambler §3 + Lemma 26). The `mode` parameter is a CLOSED enum
 * (ECC plan §4 row 5) — `"min" | "product" | "logodds"` only.
 *
 * Phase 5a (2026-06-03): the `"ds"` (Dempster–Shafer) mode was retired from
 * the public surface (confidence-algebra log-odds migration). Inbound `?mode=ds`
 * is coerced to the default for one deprecation cycle rather than hard-rejected,
 * so existing MCP/citation callers keep working; remove the coercion once no
 * traffic uses it. See RESEARCH_PROGRAMME/IMPLEMENTATION_TRACKS.md Phase 5a.
 *
 * Phase 5b (2026-06-03): the default mode is now `"logodds"` (the weight-of-
 * evidence monoid), matching the main evidential pipeline. `product` stays
 * selectable until the bake-in window closes.
 */
import { NextRequest, NextResponse } from "next/server";
import { evaluateConfidence, loadClaimArrow, type Mode } from "@/lib/argumentation/eccLoader";

export const dynamic = "force-dynamic";

const ALLOWED_MODES = new Set<Mode>(["min", "product", "logodds"]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;
  const url = new URL(req.url);
  const claimId = url.searchParams.get("claimId");
  const modeIn = (url.searchParams.get("mode") ?? "logodds").toLowerCase();
  // Phase 5a: coerce the retired "ds" mode to the default for one deprecation cycle.
  const modeRaw = (modeIn === "ds" ? "logodds" : modeIn) as Mode;
  if (!claimId) {
    return NextResponse.json(
      { ok: false, error: "claimId query parameter is required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_MODES.has(modeRaw)) {
    return NextResponse.json(
      {
        ok: false,
        error: `mode must be one of: ${Array.from(ALLOWED_MODES).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const loaded = await loadClaimArrow(deliberationId, claimId);
  if (!loaded) {
    return NextResponse.json({
      ok: true,
      deliberationId,
      claimId,
      mode: modeRaw,
      confidence: null,
      reason: "no ArgumentSupport rows for this (deliberation, claim) pair",
    });
  }

  const value = evaluateConfidence(loaded, modeRaw);
  return NextResponse.json({
    ok: true,
    deliberationId,
    claimId,
    mode: modeRaw,
    confidence: value,
    derivationCount: loaded.arrow.derivs.size,
  });
}
