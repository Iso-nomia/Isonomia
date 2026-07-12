export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  resolveOptionalAuth,
  requireAuth,
} from "@/lib/typology/apiHelpers";
import { getTag } from "@/lib/typology/tagService";
import { listEvents, verifyMetaConsensusChain } from "@/lib/typology/typologyEventService";
import { canReadTypology, redactForPublicRead } from "@/lib/typology/auth";

/**
 * GET /api/typology/tags/[id]
 *
 * Returns the tag plus the event sub-chain for this tagId.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const tag = await getTag(params.id);
  if (!tag) return apiError("CONFLICT_TAG_NOT_FOUND", "Tag not found");

  const { authId } = await resolveOptionalAuth();
  const access = await canReadTypology(authId, tag.deliberationId, tag.sessionId ?? null);
  if (!access.ok) {
    if (!authId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Tag not found");
  }

  try {
    const allEvents = await listEvents(tag.deliberationId, {
      sessionId: tag.sessionId ?? null,
      limit: 1000,
    });
    const events = allEvents.filter((e) => e.tagId === tag.id);
    const verification = await verifyMetaConsensusChain(
      tag.deliberationId,
      tag.sessionId ?? null,
    );

    const payload = {
      tag,
      events,
      hashChainValid: verification.valid,
      ...(verification.valid
        ? {}
        : { brokenAtEventId: allEvents[verification.failedIndex]?.id ?? null }),
    };
    return NextResponse.json(
      redactForPublicRead(payload, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}

// silence unused-import lint when prisma is only referenced indirectly
void prisma;
