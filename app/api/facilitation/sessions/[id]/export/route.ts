export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
} from "@/lib/facilitation/apiHelpers";
import { canManageFacilitation } from "@/lib/facilitation/auth";
import {
  buildCanonicalExport,
  FACILITATION_EXPORT_SCHEMA_VERSION,
} from "@/lib/facilitation/exportService";

/**
 * GET /api/facilitation/sessions/[id]/export
 *
 * Returns a versioned canonical JSON snapshot of the session — full hash
 * chain plus all facilitation rows and the rollup report. Suitable for
 * archival, partner hand-off, and offline chain verification.
 *
 * Access:
 *   • Facilitator/host of the deliberation: always.
 *   • Anyone (including anonymous): only when the session is `isPublic`.
 *     For public reads we never redact archival fields — the canonical
 *     export is by definition the on-chain payload.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await prisma.facilitationSession.findUnique({
    where: { id: params.id },
    select: { id: true, deliberationId: true, isPublic: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found");

  if (!session.isPublic) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    if (!(await canManageFacilitation(auth.userId, session.deliberationId))) {
      return apiError("FORBIDDEN", "Facilitator role required for export");
    }
  }

  try {
    const exportPayload = await buildCanonicalExport(params.id);
    return NextResponse.json(exportPayload, {
      headers: {
        "X-Facilitation-Export-Schema": FACILITATION_EXPORT_SCHEMA_VERSION,
        // Long cache for closed sessions; clients should send `If-None-Match`
        // in a future iteration. For now we only signal immutability through
        // the schema header above.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
