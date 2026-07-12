/**
 * Phase 10a (task 10.6a) — moderate a single external citation. Admin only.
 *
 * PATCH /api/admin/external-citations/{id}
 *   body: { trustState: "unreviewed" | "trusted" | "hidden" }
 *
 * `trusted` promotes it into the headline cited-by count; `hidden` removes it
 * from the cited-by surface (reversible); `unreviewed` sends it back to the
 * queue. This is the only place trustState is meant to change.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { requireAuth, apiError } from "@/lib/pathways/apiHelpers";
import { isPlatformAdmin } from "@/lib/pathways/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID = ["unreviewed", "trusted", "hidden"];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!isPlatformAdmin(auth.authId)) {
    return apiError("FORBIDDEN", "Platform admin required");
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { trustState?: string };
  const trustState = body?.trustState;
  if (!trustState || !VALID.includes(trustState)) {
    return apiError("BAD_REQUEST", "trustState must be one of unreviewed|trusted|hidden");
  }

  try {
    const item = await prisma.externalCitation.update({
      where: { id },
      data: { trustState: trustState as any },
      select: { id: true, trustState: true, sourceUrl: true, sourceDomain: true, targetType: true, targetId: true },
    });
    return NextResponse.json({ ok: true, item });
  } catch {
    return apiError("NOT_FOUND", "External citation not found");
  }
}
