export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  resolveOptionalAuth,
  requireAuth,
} from "@/lib/typology/apiHelpers";
import {
  buildCanonicalExport,
  TYPOLOGY_EXPORT_SCHEMA_VERSION,
} from "@/lib/typology/exportService";
import { canReadTypology } from "@/lib/typology/auth";

/**
 * GET /api/deliberations/[id]/typology/export
 *
 * Returns the versioned canonical typology JSON snapshot. Anonymous reads
 * are permitted only when the deliberation-scoped read access resolves
 * to public — i.e. every facilitation session in scope is `isPublic = true`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const delib = await prisma.deliberation.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!delib) return apiError("NOT_FOUND", "Deliberation not found");

  const { authId } = await resolveOptionalAuth();
  const access = await canReadTypology(authId, params.id, null);
  if (!access.ok) {
    if (!authId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Deliberation not found");
  }
  // Per docs/typology/AUTH_MATRIX: the canonical export is the on-chain
  // payload by definition — public reads are allowed but never redacted.

  try {
    const payload = await buildCanonicalExport(params.id);
    return NextResponse.json(payload, {
      headers: {
        "X-Typology-Export-Schema": TYPOLOGY_EXPORT_SCHEMA_VERSION,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
