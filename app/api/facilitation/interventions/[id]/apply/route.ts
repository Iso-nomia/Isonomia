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
import { ApplyInterventionSchema } from "@/lib/facilitation/schemas";
import { applyIntervention } from "@/lib/facilitation/interventionService";
import { isActiveSessionFacilitator } from "@/lib/facilitation/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = ApplyInterventionSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const intervention = await prisma.facilitationIntervention.findUnique({
    where: { id: params.id },
    select: { sessionId: true },
  });
  if (!intervention) return apiError("NOT_FOUND", "Intervention not found");

  if (!(await isActiveSessionFacilitator(auth.userId, intervention.sessionId))) {
    return apiError(
      "FORBIDDEN",
      "Only the session's active facilitator may apply interventions",
    );
  }

  try {
    const updated = await applyIntervention({
      interventionId: params.id,
      appliedById: auth.userId,
      noteText: parsed.data.noteText ?? null,
    });
    return NextResponse.json({ intervention: updated });
  } catch (err) {
    return mapServiceError(err);
  }
}
