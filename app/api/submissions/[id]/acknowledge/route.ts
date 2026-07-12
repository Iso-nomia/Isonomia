export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { AcknowledgeSubmissionSchema } from "@/lib/pathways/schemas";
import { acknowledgeSubmission } from "@/lib/pathways/submissionService";
import { canActAsInstitution, loadSubmissionContext } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = AcknowledgeSubmissionSchema.safeParse(
    (await parseJson(req)) ?? {},
  );
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
    const submission = await acknowledgeSubmission({
      submissionId: params.id,
      acknowledgedById: auth.userId,
    });
    return NextResponse.json({ submission });
  } catch (err) {
    return mapServiceError(err);
  }
}
