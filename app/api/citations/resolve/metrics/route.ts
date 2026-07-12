/**
 * GET /api/citations/resolve/metrics
 *
 * Phase 8 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * In-process counters for the citation resolver: total resolutions,
 * cache-hit ratio, breakdown by `resolvedFrom` and `confidence`, and
 * per-host circuit-breaker states. Resets on process restart — this is
 * a developer/operator dashboard, not a long-term metric store.
 *
 * Auth: required. Returns plain JSON.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { resolveCitationCallerUserId } from "@/lib/citation/mcpAuth";
import { getResolverMetrics } from "@/lib/citation/telemetry";
import { getBreakerStates } from "@/lib/citation/resolve/rateLimit";

export async function GET(req: NextRequest) {
  const userId = await resolveCitationCallerUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({
    resolver: getResolverMetrics(),
    breakers: getBreakerStates(),
    pid: process.pid,
    capturedAt: new Date().toISOString(),
  });
}
