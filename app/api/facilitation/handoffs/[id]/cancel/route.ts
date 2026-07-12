export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { RespondHandoffSchema } from "@/lib/facilitation/schemas";
import { cancelHandoff } from "@/lib/facilitation/handoffService";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = RespondHandoffSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  try {
    const handoff = await cancelHandoff({
      handoffId: params.id,
      actorId: auth.userId,
      notesText: parsed.data.notesText ?? null,
    });
    return NextResponse.json({ handoff });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/handoff initiator mismatch/i.test(msg)) return apiError("FORBIDDEN", msg);
    return mapServiceError(err);
  }
}
