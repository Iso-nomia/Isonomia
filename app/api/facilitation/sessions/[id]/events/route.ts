export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  requireAuth,
  resolveOptionalAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { ListEventsQuerySchema } from "@/lib/facilitation/schemas";
import { listEvents, verifyFacilitationChain } from "@/lib/facilitation/eventService";
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
  const parsed = ListEventsQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return zodError(parsed.error);

  try {
    const events = await listEvents(params.id, {
      limit: parsed.data.limit ?? 100,
      cursor: parsed.data.cursor,
      eventType: parsed.data.eventType,
    });
    const verification = await verifyFacilitationChain(params.id);

    const items = events.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      eventType: e.eventType,
      actorId: e.actorId,
      actorRole: e.actorRole,
      payloadJson: e.payloadJson,
      hashChainPrev: e.hashChainPrev,
      hashChainSelf: e.hashChainSelf,
      metricSnapshotId: e.metricSnapshotId,
      interventionId: e.interventionId,
      createdAt: e.createdAt,
    }));

    const payload = {
      items,
      hashChainValid: verification.valid,
      ...(verification.valid
        ? {}
        : { hashChainFailure: { failedIndex: verification.failedIndex } }),
    };
    return NextResponse.json(
      redactForPublicRead(payload, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
