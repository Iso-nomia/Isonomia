export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
} from "@/lib/facilitation/apiHelpers";
import { runChecks } from "@/lib/facilitation/questionService";
import { canManageFacilitation } from "@/lib/facilitation/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const existing = await prisma.facilitationQuestion.findUnique({
    where: { id: params.id },
    select: { deliberationId: true },
  });
  if (!existing) return apiError("NOT_FOUND", "Question not found");

  if (!(await canManageFacilitation(auth.userId, existing.deliberationId))) {
    return apiError("FORBIDDEN", "Facilitator role required to run checks");
  }

  try {
    const out = await runChecks({ questionId: params.id });
    return NextResponse.json(out);
  } catch (err) {
    return mapServiceError(err);
  }
}
