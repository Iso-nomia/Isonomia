/**
 * GET /api/v3/deliberations/[id]/behaviours
 *
 * Enumerate every Behaviour in a deliberation with summary stats
 * (incarnationCount, coneCount, moveCount, walkedCount, witnessRatio).
 * Sorted by incarnationCount desc, so `behaviours[0]` is the
 * most-articulated one — useful as a cold-start entry point.
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 * T4 invariant: no participantId in the response.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError, enforceTokenScope } from "@/server/ludics/auth";
import { listBehaviours } from "@/server/ludics/listBehaviours";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;

  let caller;
  try {
    caller = await resolveLudicsReadCaller(request);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    enforceTokenScope(caller, deliberationId);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  const result = await listBehaviours(deliberationId);
  return NextResponse.json({ ok: true, ...result });
}
