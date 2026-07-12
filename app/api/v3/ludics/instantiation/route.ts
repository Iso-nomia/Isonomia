/**
 * GET /api/v3/ludics/instantiation
 *
 * Look up which Ludics node a given dialogueMoveId instantiates via ι(·).
 * Returns instantiated: true with locus data if found, false otherwise.
 *
 * Query params:
 *   dialogueMoveId  string  (required)
 *
 * Auth (WS-3 / v2.5): scoped JWT (preferred) | session cookie.
 *   (Legacy MCP_API_TOKEN bearer fallback was removed in the v2.5 cutover.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getInstantiation } from "@/server/ludics/instantiation";
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
  const dialogueMoveId = searchParams.get("dialogueMoveId");
  if (!dialogueMoveId) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: dialogueMoveId" },
      { status: 400 }
    );
  }

  const result = await getInstantiation(dialogueMoveId);
  return NextResponse.json({ ok: true, ...result });
}
