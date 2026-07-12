export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { AuthorQuestionSchema } from "@/lib/facilitation/schemas";
import { authorQuestion } from "@/lib/facilitation/questionService";
import { canManageFacilitation } from "@/lib/facilitation/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = AuthorQuestionSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canManageFacilitation(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Facilitator role required to author a question");
  }

  try {
    const question = await authorQuestion({
      deliberationId: params.id,
      authoredById: auth.userId,
      text: parsed.data.text,
      framingType: parsed.data.framingType,
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
