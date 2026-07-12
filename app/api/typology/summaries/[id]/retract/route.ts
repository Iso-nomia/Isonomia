export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { RetractSummarySchema } from "@/lib/typology/schemas";
import { getSummary, retractSummary } from "@/lib/typology/summaryService";
import { canPublishSummary } from "@/lib/typology/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = RetractSummarySchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const summary = await getSummary(params.id);
  if (!summary) return apiError("CONFLICT_SUMMARY_NOT_FOUND", "Summary not found");

  if (!(await canPublishSummary(auth.userId, summary.deliberationId))) {
    return apiError("FORBIDDEN", "Facilitator role required to retract a summary");
  }

  try {
    const retracted = await retractSummary(params.id, auth.userId, parsed.data.reasonText);
    return NextResponse.json({ summary: retracted }, { status: 200 });
  } catch (err) {
    return mapServiceError(err);
  }
}
