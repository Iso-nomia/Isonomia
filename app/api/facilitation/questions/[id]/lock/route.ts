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
import { LockQuestionSchema } from "@/lib/facilitation/schemas";
import { LockGateError, lockQuestion } from "@/lib/facilitation/questionService";
import { canManageFacilitation } from "@/lib/facilitation/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = LockQuestionSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const existing = await prisma.facilitationQuestion.findUnique({
    where: { id: params.id },
    select: { deliberationId: true },
  });
  if (!existing) return apiError("NOT_FOUND", "Question not found");

  if (!(await canManageFacilitation(auth.userId, existing.deliberationId))) {
    return apiError("FORBIDDEN", "Facilitator role required to lock a question");
  }

  try {
    const question = await lockQuestion({
      questionId: params.id,
      lockedById: auth.userId,
      acknowledgedCheckIds: parsed.data.acknowledgedCheckIds,
    });
    return NextResponse.json({ question });
  } catch (err) {
    if (err instanceof LockGateError) {
      // BLOCK / WARN gates → 422 with structured details (decision: 422 keeps
      // failures user-actionable; 409 reserved for state conflicts).
      if (err.code === "BLOCK_SEVERITY_UNRESOLVED") {
        return apiError("CONFLICT_BLOCK_SEVERITY_UNRESOLVED", err.message, {
          code: err.code,
          offendingCheckIds: err.offendingCheckIds,
        });
      }
      return apiError("VALIDATION_ERROR", err.message, {
        code: err.code,
        offendingCheckIds: err.offendingCheckIds,
      });
    }
    return mapServiceError(err);
  }
}
