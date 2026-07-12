export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { CreatePacketSchema } from "@/lib/pathways/schemas";
import { createDraft } from "@/lib/pathways/packetService";
import { prisma } from "@/lib/prismaclient";
import { PacketStatus } from "@/lib/pathways/types";
import { canEditPacket, loadPathwayContext } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = CreatePacketSchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const ctx = await loadPathwayContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Pathway not found");
  if (!(await canEditPacket(ctx.deliberationId, auth.userId))) {
    return apiError("FORBIDDEN", "Deliberation contributor role required");
  }

  try {
    // Enforce one editable draft at a time.
    const existingDraft = await prisma.recommendationPacket.findFirst({
      where: { pathwayId: params.id, status: PacketStatus.DRAFT },
      select: { id: true },
    });
    if (existingDraft) {
      return apiError(
        "CONFLICT_PACKET_FROZEN",
        "A DRAFT packet already exists for this pathway",
        { packetId: existingDraft.id },
      );
    }

    const packet = await createDraft({
      pathwayId: params.id,
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      createdById: auth.userId,
    });
    return NextResponse.json({ packet }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
