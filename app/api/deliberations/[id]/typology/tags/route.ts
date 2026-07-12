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
import { ProposeTagSchema } from "@/lib/typology/schemas";
import { listTags, proposeTag } from "@/lib/typology/tagService";
import { resolveActiveAxis } from "@/lib/typology/axisRegistry";
import {
  canProposeTag,
  canReadTypology,
  redactForPublicRead,
} from "@/lib/typology/auth";
import {
  DisagreementAxisKey,
  DisagreementTagTargetType,
} from "@/lib/typology/types";

/** POST — propose / upsert a tag. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = ProposeTagSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canProposeTag(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Participant role required to propose a tag");
  }

  try {
    const result = await proposeTag({
      ...parsed.data,
      deliberationId: params.id,
      authoredById: auth.userId,
    });
    return NextResponse.json(
      { tag: result.tag, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    return mapServiceError(err);
  }
}

/** GET — list tags for a deliberation. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { authId } = await resolveOptionalAuth();
  const url = new URL(req.url);
  const sessionIdRaw = url.searchParams.get("sessionId");
  const sessionId =
    sessionIdRaw === null ? null : sessionIdRaw === "null" ? null : sessionIdRaw;

  const access = await canReadTypology(authId, params.id, sessionId);
  if (!access.ok) {
    if (!authId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    }
    return apiError("NOT_FOUND", "Deliberation not found");
  }

  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId") ?? undefined;
  const axisKey = url.searchParams.get("axisKey");
  const includeRetracted = url.searchParams.get("includeRetracted") === "true";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200);

  let axisId: string | undefined;
  if (axisKey) {
    try {
      axisId = (await resolveActiveAxis(axisKey as DisagreementAxisKey)).axisId;
    } catch (err) {
      return mapServiceError(err);
    }
  }

  try {
    const tags = await listTags(params.id, {
      sessionId: sessionIdRaw === null ? undefined : sessionId,
      targetType: (targetType as DisagreementTagTargetType | null) ?? undefined,
      targetId,
      axisId,
      includeRetracted,
      limit,
      cursor,
    });
    const nextCursor = tags.length === limit ? tags[tags.length - 1].id : null;
    const payload = { tags, nextCursor };
    return NextResponse.json(
      redactForPublicRead(payload, { publicReadOnly: access.publicReadOnly }),
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
