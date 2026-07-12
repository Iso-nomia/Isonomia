/**
 * GET /api/v3/deliberations/[id]/fingerprint
 *
 * Track AI-EPI Pt. 4 §1 — DeliberationFingerprint endpoint.
 *
 * Returns a deterministic, deliberation-scope summary of the argument
 * graph. The `contentHash` is the cache key for every other Pt. 4
 * deliberation-scope readout. Public, cache-friendly.
 */
import { NextRequest, NextResponse } from "next/server";
import { computeDeliberationFingerprint } from "@/lib/deliberation/fingerprint";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const fingerprint = await computeDeliberationFingerprint(id);
    if (!fingerprint) {
      return NextResponse.json(
        { error: "deliberation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(fingerprint, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Content-Hash": fingerprint.contentHash,
      },
    });
  } catch (err: any) {
    if (err?.code === "P1001" || err?.code === "P1002" || err?.code === "P1017") {
      return NextResponse.json(
        { error: "upstream unavailable", code: err.code },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    throw err;
  }
}
