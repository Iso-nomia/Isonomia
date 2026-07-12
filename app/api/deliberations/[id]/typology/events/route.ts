export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  requireAuth,
  resolveOptionalAuth,
} from "@/lib/typology/apiHelpers";
import {
  listEvents,
  verifyMetaConsensusChain,
} from "@/lib/typology/typologyEventService";
import { canReadTypology, redactForPublicRead } from "@/lib/typology/auth";

/**
 * GET /api/deliberations/[id]/typology/events
 *
 * Append-only event feed for the typology / meta-consensus chain.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { authId } = await resolveOptionalAuth();
  const url = new URL(req.url);
  const sessionIdRaw = url.searchParams.get("sessionId");
  const sessionId = sessionIdRaw === null ? null : sessionIdRaw === "null" ? null : sessionIdRaw;

  const access = await canReadTypology(authId, params.id, sessionId);
  if (!access.ok) {
    if (!authId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Deliberation not found");
  }

  const eventType = url.searchParams.get("eventType") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1), 500);

  try {
    const events = await listEvents(params.id, {
      sessionId: sessionIdRaw === null ? undefined : sessionId,
      eventType,
      limit,
      cursor,
    });
    const verification = await verifyMetaConsensusChain(params.id, sessionId);
    const nextCursor = events.length === limit ? events[events.length - 1].id : null;

    const payload = {
      events,
      nextCursor,
      hashChainValid: verification.valid,
      brokenAtEventId: verification.valid
        ? null
        : events[verification.failedIndex]?.id ?? null,
    };
    return NextResponse.json(
      redactForPublicRead(payload, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
