export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { ClosePathwaySchema } from "@/lib/pathways/schemas";
import { closePathway } from "@/lib/pathways/pathwayService";
import { isDeliberationHost, loadPathwayContext } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = ClosePathwaySchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const ctx = await loadPathwayContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Pathway not found");
  if (!(await isDeliberationHost(ctx.deliberationId, auth.userId))) {
    return apiError("FORBIDDEN", "Only the deliberation host may close a pathway");
  }

  try {
    const pathway = await closePathway(
      params.id,
      auth.userId,
      parsed.data.reason ?? undefined,
    );
    return NextResponse.json({ pathway });
  } catch (err) {
    return mapServiceError(err);
  }
}
