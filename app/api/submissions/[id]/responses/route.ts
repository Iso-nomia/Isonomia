export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { RecordResponseSchema } from "@/lib/pathways/schemas";
import { recordResponse } from "@/lib/pathways/responseService";
import { canActAsInstitution, loadSubmissionContext } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = RecordResponseSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const ctx = await loadSubmissionContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Submission not found");
  const allowed = await canActAsInstitution(
    ctx.institutionId,
    ctx.packet.pathway.deliberationId,
    auth.userId,
  );
  if (!allowed) {
    return apiError(
      "FORBIDDEN",
      "Verified institution member or deliberation facilitator required",
    );
  }

  try {
    const { response } = await recordResponse({
      submissionId: params.id,
      respondedById: auth.userId,
      dispositionSummary: parsed.data.dispositionSummary ?? null,
      responseStatus: parsed.data.responseStatus,
      items: [],
    });
    return NextResponse.json({ response }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
