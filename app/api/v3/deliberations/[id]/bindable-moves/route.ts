/**
 * GET /api/v3/deliberations/[id]/bindable-moves
 *
 * Cluster D helper read — `list_bindable_moves`.
 *
 * Returns LudicMoves in this deliberation that can be the target of
 * `bind_participant_to_design`, optionally constrained to a design /
 * behaviour / locus, paired with any DialogueMoves that could serve as
 * the witnessing dialogue act.
 *
 * Query params:
 *   designId           string  (optional)
 *   behaviourId        string  (optional; ignored if designId is set)
 *   locus              string  (optional)
 *   includeWitnessed   boolean (optional, default false)
 *   limit              integer (optional, default 50, max 200)
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError, enforceTokenScope } from "@/server/ludics/auth";
import { listBindableMoves } from "@/server/ludics/listBindableMoves";

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

  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("designId") ?? undefined;
  const behaviourId = searchParams.get("behaviourId") ?? undefined;
  const locus = searchParams.get("locus") ?? undefined;
  const includeWitnessed = searchParams.get("includeWitnessed") === "true";
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const result = await listBindableMoves(deliberationId, {
    designId,
    behaviourId,
    locus,
    includeWitnessed,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({ ok: true, ...result });
}
