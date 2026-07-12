export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/typology/apiHelpers";
import { PublishSummarySchema } from "@/lib/typology/schemas";
import { getSummary, publishSummary } from "@/lib/typology/summaryService";
import { canPublishSummary } from "@/lib/typology/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = PublishSummarySchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const summary = await getSummary(params.id);
  if (!summary) return apiError("CONFLICT_SUMMARY_NOT_FOUND", "Summary not found");

  if (!(await canPublishSummary(auth.userId, summary.deliberationId))) {
    return apiError("FORBIDDEN", "Facilitator role required to publish a summary");
  }

  try {
    const published = await publishSummary(params.id, auth.userId);
    return NextResponse.json({ summary: published }, { status: 200 });
  } catch (err) {
    return mapServiceError(err);
  }
}
