/**
 * Phase 10a (task 10.6a) — moderation surface for external (Webmention)
 * citations. Platform-admin only.
 *
 * GET /api/admin/external-citations?state=unreviewed|trusted|hidden|all&limit=
 *   → the moderation queue. Defaults to `unreviewed` (the review backlog).
 *
 * Per D2 this is POST-HOC moderation: citations are already displayed as
 * `unreviewed`; a moderator promotes (`trusted`) or removes (`hidden`) them
 * here. Trust/hide is reversible.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { requireAuth, apiError } from "@/lib/pathways/apiHelpers";
import { isPlatformAdmin } from "@/lib/pathways/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATES = ["unreviewed", "trusted", "hidden", "all"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!isPlatformAdmin(auth.authId)) {
    return apiError("FORBIDDEN", "Platform admin required");
  }

  const sp = req.nextUrl.searchParams;
  const stateRaw = (sp.get("state") ?? "unreviewed").toLowerCase();
  const state = (STATES as readonly string[]).includes(stateRaw) ? stateRaw : "unreviewed";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));

  const rows = await prisma.externalCitation.findMany({
    where: state === "all" ? {} : { trustState: state as any },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, state, count: rows.length, items: rows });
}
