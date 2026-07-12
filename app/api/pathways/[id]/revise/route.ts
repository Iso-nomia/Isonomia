export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { RevisePathwaySchema } from "@/lib/pathways/schemas";
import { createDraft } from "@/lib/pathways/packetService";
import { markInRevision } from "@/lib/pathways/pathwayService";
import { prisma } from "@/lib/prismaclient";
import { isFacilitator } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = RevisePathwaySchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  try {
    const pathway = await prisma.institutionalPathway.findUnique({
      where: { id: params.id },
      select: { id: true, currentPacketId: true, status: true, deliberationId: true },
    });
    if (!pathway) return apiError("NOT_FOUND", "Pathway not found");
    if (!(await isFacilitator(pathway.deliberationId, auth.userId))) {
      return apiError("FORBIDDEN", "Facilitator role required to revise a pathway");
    }

    const packet = await createDraft({
      pathwayId: pathway.id,
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      createdById: auth.userId,
      parentPacketId: pathway.currentPacketId,
    });

    await markInRevision(pathway.id, auth.userId, `Opened revision "${parsed.data.title}"`);

    return NextResponse.json({ packet }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
