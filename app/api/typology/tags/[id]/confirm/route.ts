export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { ConfirmTagSchema } from "@/lib/typology/schemas";
import { confirmTag } from "@/lib/typology/tagService";
import { canConfirmTag } from "@/lib/typology/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = ConfirmTagSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canConfirmTag(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Original author or facilitator required to confirm a tag");
  }

  try {
    const tag = await confirmTag(params.id, auth.userId, { confidence: parsed.data.confidence });
    return NextResponse.json({ tag }, { status: 200 });
  } catch (err) {
    return mapServiceError(err);
  }
}
