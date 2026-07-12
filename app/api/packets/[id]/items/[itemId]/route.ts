export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { EditPacketItemSchema } from "@/lib/pathways/schemas";
import { removeItem } from "@/lib/pathways/packetService";
import { PacketStatus } from "@/lib/pathways/types";
import { canEditPacket, loadPacketContext } from "@/lib/pathways/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = EditPacketItemSchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const ctx = await loadPacketContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Packet not found");
  if (!(await canEditPacket(ctx.pathway.deliberationId, auth.userId))) {
    return apiError("FORBIDDEN", "Deliberation contributor role required");
  }

  try {
    const item = await prisma.recommendationPacketItem.findUnique({
      where: { id: params.itemId },
      include: { packet: { select: { status: true, id: true } } },
    });
    if (!item || item.packetId !== params.id) {
      return apiError("NOT_FOUND", "Packet item not found");
    }
    if (item.packet.status !== PacketStatus.DRAFT) {
      return apiError(
        "CONFLICT_PACKET_FROZEN",
        `Cannot edit items on packet in status ${item.packet.status}`,
      );
    }

    const updated = await prisma.recommendationPacketItem.update({
      where: { id: params.itemId },
      data: {
        ...(parsed.data.orderIndex !== undefined
          ? { orderIndex: parsed.data.orderIndex }
          : {}),
        ...(parsed.data.commentary !== undefined
          ? { commentary: parsed.data.commentary }
          : {}),
      },
    });
    return NextResponse.json({ item: updated });
  } catch (err) {
    return mapServiceError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const ctx = await loadPacketContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Packet not found");
  if (!(await canEditPacket(ctx.pathway.deliberationId, auth.userId))) {
    return apiError("FORBIDDEN", "Deliberation contributor role required");
  }

  try {
    const item = await prisma.recommendationPacketItem.findUnique({
      where: { id: params.itemId },
      select: { packetId: true },
    });
    if (!item || item.packetId !== params.id) {
      return apiError("NOT_FOUND", "Packet item not found");
    }

    await removeItem(params.itemId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapServiceError(err);
  }
}
