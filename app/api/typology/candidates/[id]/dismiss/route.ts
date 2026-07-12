export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { DismissCandidateSchema } from "@/lib/typology/schemas";
import { dismissCandidate, getCandidate } from "@/lib/typology/candidateService";
import { canManageCandidates } from "@/lib/typology/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = DismissCandidateSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const candidate = await getCandidate(params.id);
  if (!candidate) return apiError("CONFLICT_CANDIDATE_NOT_FOUND", "Candidate not found");

  if (!(await canManageCandidates(auth.userId, candidate.sessionId))) {
    return apiError(
      "FORBIDDEN",
      "Active-session facilitator required to dismiss a candidate",
    );
  }

  try {
    const dismissed = await dismissCandidate(params.id, auth.userId, parsed.data.reasonText);
    return NextResponse.json({ candidate: dismissed }, { status: 200 });
  } catch (err) {
    return mapServiceError(err);
  }
}
