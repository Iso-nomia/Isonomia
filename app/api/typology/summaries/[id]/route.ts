export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  resolveOptionalAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { EditDraftSchema } from "@/lib/typology/schemas";
import { editDraft, getSummary } from "@/lib/typology/summaryService";
import { listEvents, verifyMetaConsensusChain } from "@/lib/typology/typologyEventService";
import { listTags } from "@/lib/typology/tagService";
import {
  canEditDraft,
  canReadTypology,
  redactForPublicRead,
} from "@/lib/typology/auth";
import type { MetaConsensusSummaryBody } from "@/lib/typology/types";

/** GET — summary detail with supporting tags + events sub-chain. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const summary = await getSummary(params.id);
  if (!summary) return apiError("CONFLICT_SUMMARY_NOT_FOUND", "Summary not found");

  const { authId } = await resolveOptionalAuth();
  const access = await canReadTypology(authId, summary.deliberationId, summary.sessionId);
  if (!access.ok) {
    if (!authId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Summary not found");
  }

  try {
    const body = summary.bodyJson as unknown as MetaConsensusSummaryBody;
    const tagIds = Array.from(
      new Set(body.disagreedOn?.flatMap((d) => d.supportingTagIds ?? []) ?? []),
    );
    const supportingTags = tagIds.length
      ? (await listTags(summary.deliberationId, { limit: 200 })).filter((t) =>
          tagIds.includes(t.id),
        )
      : [];

    const allEvents = await listEvents(summary.deliberationId, {
      sessionId: summary.sessionId,
      limit: 1000,
    });
    const events = allEvents.filter((e) => e.summaryId === summary.id);
    const verification = await verifyMetaConsensusChain(
      summary.deliberationId,
      summary.sessionId,
    );

    const payload = {
      summary,
      supportingTags,
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

/** PATCH — edit a DRAFT summary. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = EditDraftSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canEditDraft(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Only the original drafter can edit a DRAFT summary");
  }

  try {
    const summary = await editDraft(params.id, parsed.data);
    return NextResponse.json({ summary }, { status: 200 });
  } catch (err) {
    return mapServiceError(err);
  }
}
