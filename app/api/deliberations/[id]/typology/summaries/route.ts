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
import { DraftSummarySchema } from "@/lib/typology/schemas";
import { draftSummary, listSummaries } from "@/lib/typology/summaryService";
import {
  canDraftSummary,
  canReadTypology,
  redactForPublicRead,
} from "@/lib/typology/auth";
import { MetaConsensusSummaryStatus } from "@/lib/typology/types";

/** POST — draft a new summary. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = DraftSummarySchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canDraftSummary(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Facilitator role required to draft a summary");
  }

  try {
    const summary = await draftSummary({
      ...parsed.data,
      deliberationId: params.id,
      authoredById: auth.userId,
    });
    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}

/** GET — list summaries. */
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

  const all = url.searchParams.get("all") === "true";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200);

  try {
    const summaries = await listSummaries(params.id, {
      sessionId: sessionIdRaw === null ? undefined : sessionId,
      ...(all ? {} : { status: MetaConsensusSummaryStatus.PUBLISHED }),
      cursor,
      limit,
    });
    const nextCursor =
      summaries.length === limit ? summaries[summaries.length - 1].id : null;
    const payload = { summaries, nextCursor };
    return NextResponse.json(
      redactForPublicRead(payload, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
