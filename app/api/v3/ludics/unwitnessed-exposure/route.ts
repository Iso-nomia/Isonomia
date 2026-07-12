/**
 * GET /api/v3/ludics/unwitnessed-exposure
 *
 * Returns LudicMoves in a deliberation that have no active WitnessRecord
 * (structural objections not yet addressed via the ι(·) write seam).
 *
 * Query params:
 *   deliberationId   string                           (required)
 *   stratum          "witnessable" | "latent" | "all" (optional, default "witnessable")
 *   limit            number 1-100                     (optional, default 20)
 *
 * Auth (WS-3 / v2.5): scoped JWT (preferred; scope.deliberationId must match
 * `deliberationId` query param) | session cookie.
 *   (Legacy MCP_API_TOKEN bearer fallback was removed in the v2.5 cutover.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUnwitnessedExposure, ExposureStratum } from "@/server/ludics/exposure";
import {
  resolveLudicsCaller,
  enforceTokenScope,
  LudicsAuthError,
} from "@/server/ludics/auth";

export const dynamic = "force-dynamic";

const VALID_STRATA = new Set<ExposureStratum>(["witnessable", "latent", "all"]);

export async function GET(request: NextRequest) {
  let caller;
  try {
    caller = await resolveLudicsCaller(request);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const deliberationId = searchParams.get("deliberationId");
  if (!deliberationId) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: deliberationId" },
      { status: 400 }
    );
  }

  // WS-3: enforce JWT scope vs requested deliberation.
  try {
    enforceTokenScope(caller, deliberationId);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }

  const rawStratum = (searchParams.get("stratum") ?? "witnessable") as ExposureStratum;
  if (!VALID_STRATA.has(rawStratum)) {
    return NextResponse.json(
      { ok: false, error: `Invalid stratum. Must be one of: witnessable, latent, all` },
      { status: 400 }
    );
  }

  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);

  const result = await getUnwitnessedExposure(deliberationId, rawStratum, limit);
  return NextResponse.json({ ok: true, ...result });
}
