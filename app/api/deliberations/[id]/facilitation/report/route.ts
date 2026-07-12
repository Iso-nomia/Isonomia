export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
} from "@/lib/facilitation/apiHelpers";
import { canManageFacilitation } from "@/lib/facilitation/auth";
import { buildReport } from "@/lib/facilitation/reportService";
import { FacilitationSessionStatus } from "@/lib/facilitation/types";

/**
 * GET /api/deliberations/[id]/facilitation/report?sessionId=...
 *
 * Returns the post-session aggregated report. If `sessionId` is omitted,
 * resolves to the latest non-OPEN (closed/escalated) session for the
 * deliberation.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  if (!(await canManageFacilitation(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Facilitator role required to view reports");
  }

  const url = new URL(req.url);
  const explicit = url.searchParams.get("sessionId");

  let sessionId = explicit ?? null;
  if (!sessionId) {
    const latest = await prisma.facilitationSession.findFirst({
      where: { deliberationId: params.id, status: { not: FacilitationSessionStatus.OPEN } },
      orderBy: { closedAt: "desc" },
      select: { id: true },
    });
    sessionId = latest?.id ?? null;
  } else {
    const owns = await prisma.facilitationSession.findFirst({
      where: { id: sessionId, deliberationId: params.id },
      select: { id: true },
    });
    if (!owns) return apiError("NOT_FOUND", "Session does not belong to this deliberation");
  }

  if (!sessionId) {
    return apiError("NOT_FOUND", "No closed session found for this deliberation");
  }

  try {
    const report = await buildReport(sessionId);
    return NextResponse.json({ report });
  } catch (err) {
    return mapServiceError(err);
  }
}
