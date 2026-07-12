/**
 * GET /api/v3/deliberations/[id]/briefing-fingerprint/check?hash=sha256:...
 *
 * §5.2 — Check whether a previously issued briefing hash is stale.
 *
 * Returns { stale: false } when the hash matches the current fingerprint.
 * Returns { stale: "R1" | "R2" | "R3" | "R4" | "R5" } when it has
 * materially changed, indicating which rule fired first.
 *
 * Query params:
 *   hash  string  required — the previously issued SHA256 hash
 *                            (e.g. "sha256:abcdef...")
 *
 * Auth: session cookie or MCP_API_TOKEN bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { checkBriefingFingerprint } from "@/server/ludics/briefingFingerprint";

export const dynamic = "force-dynamic";

async function resolveCallerUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const expected = process.env.MCP_API_TOKEN;
  if (m && expected && m[1] === expected) {
    return process.env.MCP_AUTHOR_USER_ID ?? "mcp-system";
  }
  return (await getCurrentUserId())?.toString() ?? null;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const callerId = await resolveCallerUserId(request);
  if (!callerId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: deliberationId } = await ctx.params;

  const hash = request.nextUrl.searchParams.get("hash");
  if (!hash) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: hash" },
      { status: 400 },
    );
  }

  const result = await checkBriefingFingerprint(deliberationId, hash);
  return NextResponse.json({ ok: true, ...result });
}
