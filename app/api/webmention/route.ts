/**
 * Phase 10a (task 10.6) — Webmention receiver.
 *
 * POST /api/webmention  (application/x-www-form-urlencoded or JSON)
 *   body: { source, target }
 *
 * An external page that links one of our permalinks POSTs a mention here. We
 * verify the target is ours, fetch the source (SSRF-guarded, no redirects,
 * size-capped), confirm it actually links back, and record it as an
 * `ExternalCitation`. Per D2 it lands `unreviewed` — displayed by default but
 * excluded from the headline cited-by count until a moderator promotes it.
 *
 * Advertised via `<link rel="webmention">` on the argument page.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  parseTargetPath,
  resolveTargetId,
  verifyBacklink,
  recordExternalCitation,
  checkDomainRateLimit,
} from "@/lib/citation/webmention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cors() {
  return { "Access-Control-Allow-Origin": "*" };
}

async function readParams(
  req: NextRequest,
): Promise<{ source?: string; target?: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    return { source: body?.source, target: body?.target };
  }
  // Default to form-encoded, per the Webmention spec.
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  return {
    source: (form.get("source") as string) ?? undefined,
    target: (form.get("target") as string) ?? undefined,
  };
}

export async function GET() {
  // Minimal discovery/health response so a sender can confirm the endpoint.
  return NextResponse.json(
    { ok: true, endpoint: "webmention", method: "POST", accepts: ["source", "target"] },
    { headers: cors() },
  );
}

export async function POST(req: NextRequest) {
  const { source, target } = await readParams(req);

  if (!source || !target || typeof source !== "string" || typeof target !== "string") {
    return NextResponse.json(
      { ok: false, error: "source_and_target_required" },
      { status: 400, headers: cors() },
    );
  }
  if (source === target) {
    return NextResponse.json(
      { ok: false, error: "source_equals_target" },
      { status: 400, headers: cors() },
    );
  }

  // Cheap check first: is the target one of ours? (no fetch yet)
  const parsed = parseTargetPath(target);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "target_not_supported" },
      { status: 400, headers: cors() },
    );
  }
  const resolved = await resolveTargetId(parsed);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "target_not_found" },
      { status: 404, headers: cors() },
    );
  }

  // Per-source-domain rate limit BEFORE the network fetch, so a spammer can't
  // make us fetch on every request. Fail-open when Redis is unavailable.
  const sourceDomain = (() => {
    try {
      return new URL(source).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const rl = await checkDomainRateLimit(sourceDomain);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", domain: sourceDomain },
      { status: 429, headers: cors() },
    );
  }

  // Now fetch the (untrusted) source and confirm the backlink.
  const verified = await verifyBacklink(source, target);
  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, error: "verification_failed", reason: verified.reason },
      { status: 400, headers: cors() },
    );
  }

  const row = await recordExternalCitation({
    targetType: resolved.targetType,
    targetId: resolved.targetId,
    sourceUrl: source,
    title: verified.title,
  });

  return NextResponse.json(
    {
      ok: true,
      id: row.id,
      trustState: row.trustState,
      note: "Recorded as an unreviewed external citation. It is displayed but not counted toward this argument's cited-by total until a moderator marks it trusted.",
    },
    { status: 201, headers: cors() },
  );
}
