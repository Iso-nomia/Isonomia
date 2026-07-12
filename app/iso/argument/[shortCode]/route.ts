/**
 * Track AI-EPI E.2 — `iso:argument:<shortCode>` resolver.
 *
 * Canonical HTTP form for the URN identifier. Permanent (301) redirect
 * to the public argument permalink at /a/<shortCode>. Tools that follow
 * the iso: id as a URL (`https://isonomia.app/iso/argument/<shortCode>`)
 * land on the human-readable page, while machine consumers can detect
 * the redirect target and reuse the existing /a/[identifier] content
 * negotiation (Accept header / ?format= → /api/a/[identifier]/aif).
 *
 * Future expansion: `/iso/claim/<moid>` and `/iso/deliberation/<id>`
 * follow the same pattern; we register them as separate route files
 * when the backing entities ship public pages.
 */

import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export const dynamic = "force-dynamic";

export function GET(
  _req: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  const sc = params.shortCode;
  if (!sc || !/^[A-Za-z0-9_-]{4,64}$/.test(sc)) {
    return NextResponse.json(
      { ok: false, error: "Invalid shortCode" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  const target = `${BASE_URL}/a/${encodeURIComponent(sc)}`;
  return NextResponse.redirect(target, {
    status: 301,
    headers: {
      "Cache-Control": "public, max-age=86400",
      "X-Isonomia-Iso-Id": `iso:argument:${sc}`,
    },
  });
}
