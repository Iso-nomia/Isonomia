export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { AddPacketItemSchema } from "@/lib/pathways/schemas";
import { addItem } from "@/lib/pathways/packetService";
import { canEditPacket, loadPacketContext } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = AddPacketItemSchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const ctx = await loadPacketContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Packet not found");
  if (!(await canEditPacket(ctx.pathway.deliberationId, auth.userId))) {
    return apiError("FORBIDDEN", "Deliberation contributor role required");
  }

  try {
    const item = await addItem({
      packetId: params.id,
      kind: parsed.data.kind,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      orderIndex: parsed.data.orderIndex,
      commentary: parsed.data.commentary ?? null,
      actorId: auth.userId,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
