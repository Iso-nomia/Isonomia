export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { ReviseQuestionSchema } from "@/lib/facilitation/schemas";
import { reviseQuestion } from "@/lib/facilitation/questionService";
import { canManageFacilitation } from "@/lib/facilitation/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = ReviseQuestionSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const existing = await prisma.facilitationQuestion.findUnique({
    where: { id: params.id },
    select: { deliberationId: true },
  });
  if (!existing) return apiError("NOT_FOUND", "Question not found");

  if (!(await canManageFacilitation(auth.userId, existing.deliberationId))) {
    return apiError("FORBIDDEN", "Facilitator role required to revise a question");
  }

  try {
    const question = await reviseQuestion({
      questionId: params.id,
      authoredById: auth.userId,
      text: parsed.data.text,
      framingType: parsed.data.framingType,
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
