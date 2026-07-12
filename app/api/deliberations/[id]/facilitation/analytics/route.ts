export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  requireAuth,
} from "@/lib/facilitation/apiHelpers";
import { canManageFacilitation } from "@/lib/facilitation/auth";
import { buildDeliberationAnalytics } from "@/lib/facilitation/analyticsService";

/**
 * GET /api/deliberations/[id]/facilitation/analytics
 *
 * Cross-session rollup for the deliberation. Per-session details still come
 * from `/facilitation/report?sessionId=...`. Facilitator-only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  if (!(await canManageFacilitation(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Facilitator role required to view analytics");
  }

  try {
    const analytics = await buildDeliberationAnalytics(params.id);
    return NextResponse.json({ analytics });
  } catch (err) {
    return mapServiceError(err);
  }
}
