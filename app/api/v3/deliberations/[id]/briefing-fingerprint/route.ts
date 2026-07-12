/**
 * GET /api/v3/deliberations/[id]/briefing-fingerprint
 *
 * §5.1 — Compute the current briefing fingerprint for a deliberation.
 *
 * Returns a content-hash over the five material fields that the AI-EPI
 * fidelity scorecard grades: hubSet, loadBearingRankingTop10,
 * openExposurePoints, refusal-surface conclusions, and top-15 CQ ids.
 *
 * Auth: session cookie or MCP_API_TOKEN bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { computeBriefingFingerprint } from "@/server/ludics/briefingFingerprint";

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

  const result = await computeBriefingFingerprint(deliberationId);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Deliberation not found or no synthetic readout available" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
