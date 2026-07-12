export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { PromoteCandidateSchema } from "@/lib/typology/schemas";
import { getCandidate, promoteCandidate } from "@/lib/typology/candidateService";
import { canManageCandidates } from "@/lib/typology/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = PromoteCandidateSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const candidate = await getCandidate(params.id);
  if (!candidate) return apiError("CONFLICT_CANDIDATE_NOT_FOUND", "Candidate not found");

  if (!(await canManageCandidates(auth.userId, candidate.sessionId))) {
    return apiError(
      "FORBIDDEN",
      "Active-session facilitator required to promote a candidate",
    );
  }

  try {
    const result = await promoteCandidate(params.id, auth.userId, parsed.data);
    return NextResponse.json(
      { candidate: result.candidate, tagId: result.tagId },
      { status: 201 },
    );
  } catch (err) {
    return mapServiceError(err);
  }
}
