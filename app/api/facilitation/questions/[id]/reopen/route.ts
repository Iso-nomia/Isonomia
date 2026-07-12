export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { ReopenQuestionSchema } from "@/lib/facilitation/schemas";
import { reopenQuestion } from "@/lib/facilitation/questionService";
import { canManageFacilitation } from "@/lib/facilitation/auth";

const ReopenBodySchema = ReopenQuestionSchema.extend({
  sessionId: z.string().min(1).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = ReopenBodySchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const existing = await prisma.facilitationQuestion.findUnique({
    where: { id: params.id },
    select: { deliberationId: true },
  });
  if (!existing) return apiError("NOT_FOUND", "Question not found");

  if (!(await canManageFacilitation(auth.userId, existing.deliberationId))) {
    return apiError("FORBIDDEN", "Facilitator role required to reopen a question");
  }

  try {
    const question = await reopenQuestion({
      questionId: params.id,
      reopenedById: auth.userId,
      reasonText: parsed.data.reasonText,
      sessionId: parsed.data.sessionId,
    });
    return NextResponse.json({ question });
  } catch (err) {
    return mapServiceError(err);
  }
}
