export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  requireAuth,
  resolveOptionalAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { ListInterventionsQuerySchema } from "@/lib/facilitation/schemas";
import { listInterventions } from "@/lib/facilitation/interventionService";
import { canReadFacilitation, redactForPublicRead } from "@/lib/facilitation/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await resolveOptionalAuth();
  const access = await canReadFacilitation(userId, params.id);
  if (!access.ok) {
    if (!userId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Session not found");
  }

  const url = new URL(req.url);
  const parsed = ListInterventionsQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return zodError(parsed.error);

  try {
    const result = await listInterventions({
      sessionId: params.id,
      status: parsed.data.status,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });
    return NextResponse.json(
      redactForPublicRead(result, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
