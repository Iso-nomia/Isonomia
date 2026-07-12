export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  resolveOptionalAuth,
  requireAuth,
} from "@/lib/typology/apiHelpers";
import { listCandidates } from "@/lib/typology/candidateService";
import { canReadTypology, redactForPublicRead } from "@/lib/typology/auth";

/**
 * GET /api/facilitation/sessions/[id]/typology/candidates
 *
 * Pending candidate queue for a session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await prisma.facilitationSession.findUnique({
    where: { id: params.id },
    select: { deliberationId: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found");

  const { authId } = await resolveOptionalAuth();
  const access = await canReadTypology(authId, session.deliberationId, params.id);
  if (!access.ok) {
    if (!authId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Session not found");
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "pending").toLowerCase();
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200);
  const includeResolved = status === "all" || status === "promoted" || status === "dismissed";

  try {
    let candidates = await listCandidates(params.id, { includeResolved, limit, cursor });
    if (status === "promoted") candidates = candidates.filter((c) => !!c.promotedAt);
    if (status === "dismissed") candidates = candidates.filter((c) => !!c.dismissedAt);
    const nextCursor = candidates.length === limit ? candidates[candidates.length - 1].id : null;
    const payload = { candidates, nextCursor };
    return NextResponse.json(
      redactForPublicRead(payload, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
