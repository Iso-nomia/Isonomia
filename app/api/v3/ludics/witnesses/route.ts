/**
 * GET /api/v3/ludics/witnesses
 *
 * Return the witnessing record for a specific Ludics move.
 * Anonymous by default (T4 invariant). Pass includeIdentity=true to opt in.
 *
 * Query params:
 *   ludicMoveId     string   (required)
 *   includeIdentity boolean  (optional, default false)
 *
 * Auth (WS-3 / v2.5): scoped JWT (preferred) | session cookie.
 *   (Legacy MCP_API_TOKEN bearer fallback was removed in the v2.5 cutover.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getWitnessesForMove } from "@/server/ludics/witnessRecord";
import { resolveLudicsCaller, LudicsAuthError } from "@/server/ludics/auth";

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

  const { searchParams } = new URL(request.url);
  const ludicMoveId = searchParams.get("ludicMoveId");
  if (!ludicMoveId) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: ludicMoveId" },
      { status: 400 }
    );
  }

  const includeIdentity = searchParams.get("includeIdentity") === "true";

  const result = await getWitnessesForMove(ludicMoveId, { includeIdentity });
  return NextResponse.json({ ok: true, ...result });
}
