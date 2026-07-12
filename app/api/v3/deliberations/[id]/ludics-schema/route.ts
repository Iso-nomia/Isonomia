/**
 * GET /api/v3/deliberations/[id]/ludics-schema
 *
 * Cluster F — `get_deliberation_schema`
 *
 * Returns the structural schema of a deliberation's Ludics layer:
 * locus count, optional design tree, and witnessing-coverage summary.
 * This is the orientation-level read for the Ludics layer.
 *
 * Query params:
 *   includeDesignTree  boolean  (optional, default true)
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError, enforceTokenScope } from "@/server/ludics/auth";
import { getDeliberationSchema } from "@/server/ludics/deliberationSchema";

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
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: err.status });
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
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: err.status });
    }
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const includeDesignTree = searchParams.get("includeDesignTree") !== "false";

  const result = await getDeliberationSchema(deliberationId, includeDesignTree);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Deliberation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}
