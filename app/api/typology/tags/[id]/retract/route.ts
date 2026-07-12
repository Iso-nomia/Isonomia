export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { RetractTagSchema } from "@/lib/typology/schemas";
import { retractTag } from "@/lib/typology/tagService";
import { canRetractTag } from "@/lib/typology/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = RetractTagSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canRetractTag(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Original author or facilitator required to retract a tag");
  }

  try {
    const tag = await retractTag(params.id, auth.userId, parsed.data.reasonText);
    return NextResponse.json({ tag }, { status: 200 });
  } catch (err) {
    return mapServiceError(err);
  }
}
