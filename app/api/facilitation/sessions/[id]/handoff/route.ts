export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { InitiateHandoffSchema } from "@/lib/facilitation/schemas";
import { initiateHandoff } from "@/lib/facilitation/handoffService";
import { isActiveSessionFacilitator } from "@/lib/facilitation/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = InitiateHandoffSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await isActiveSessionFacilitator(auth.userId, params.id))) {
    return apiError(
      "FORBIDDEN",
      "Only the session's active facilitator may initiate a handoff",
    );
  }

  try {
    const handoff = await initiateHandoff({
      fromSessionId: params.id,
      initiatedById: auth.userId,
      toUserId: parsed.data.toUserId,
      notesText: parsed.data.notesText ?? null,
    });
    return NextResponse.json({ handoff }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
