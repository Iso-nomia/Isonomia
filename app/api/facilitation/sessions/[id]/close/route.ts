export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { CloseSessionSchema } from "@/lib/facilitation/schemas";
import { closeSession } from "@/lib/facilitation/sessionService";
import { isActiveSessionFacilitator } from "@/lib/facilitation/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = CloseSessionSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await isActiveSessionFacilitator(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Only the session's active facilitator may close it");
  }

  try {
    const session = await closeSession({
      sessionId: params.id,
      closedById: auth.userId,
      summary: parsed.data.summary ?? null,
    });
    return NextResponse.json({ session });
  } catch (err) {
    return mapServiceError(err);
  }
}
