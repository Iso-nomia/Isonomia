/**
 * GET /api/v3/ludics/fossil-record
 *
 * Cluster E — `get_fossil_record`
 *
 * Returns the retraction history (fossilized witness records) for a
 * deliberation or specific Ludics move. Fossil records carry locus
 * back-pointers so callers can reconstruct the provenance even after
 * a locus is no longer in the current D_P.
 *
 * Query params:
 *   deliberationId  string   optional — scope to a deliberation
 *   ludicMoveId     string   optional — scope to a specific Ludics move
 *   includeActive   boolean  optional, default false — also count active records
 *   limit           number   optional, default 50 (max 200)
 *
 * At least one of deliberationId or ludicMoveId must be provided.
 *
 * T4 invariant: participantId is omitted from responses by default.
 *
 * Auth (WS-3 / v2.5): scoped JWT or session cookie.
 *   (Legacy MCP_API_TOKEN bearer fallback was removed in the v2.5 cutover.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getFossilRecord } from "@/server/ludics/fossilRecord";
import {
  resolveLudicsCaller,
  enforceTokenScope,
  LudicsAuthError,
} from "@/server/ludics/auth";

export const dynamic = "force-dynamic";

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

  const sp = request.nextUrl.searchParams;
  const deliberationId = sp.get("deliberationId") ?? undefined;
  const ludicMoveId = sp.get("ludicMoveId") ?? undefined;
  const includeActive = sp.get("includeActive") === "true";
  const limitRaw = parseInt(sp.get("limit") ?? "50", 10);
  const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(1, limitRaw), 200);

  if (!deliberationId && !ludicMoveId) {
    return NextResponse.json(
      { ok: false, error: "At least one of deliberationId or ludicMoveId is required" },
      { status: 400 },
    );
  }

  // WS-3: when scoped JWT is used and deliberationId is in the query,
  // enforce that the token's scope matches. Skipped when caller only
  // provides ludicMoveId (the service layer derives deliberationId from
  // the move and we trust that linkage for legacy / session callers).
  if (deliberationId) {
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
  }

  const result = await getFossilRecord({ deliberationId, ludicMoveId, includeActive, limit });
  return NextResponse.json({ ok: true, ...result });
}
