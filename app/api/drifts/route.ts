export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { jsonSafe } from "@/lib/bigintjson";
import { supabase } from "@/lib/supabaseclient";
import { broadcast } from "@/lib/realtime/broadcast";

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
    const userId: bigint = me.userId;

    const { conversationId, title } = await req.json();
    if (!conversationId || !title || !String(title).trim()) {
      return NextResponse.json({ ok: false, error: "conversationId and title are required" }, { status: 400 });
    }
    const convoId = BigInt(conversationId);

    // Ensure participant
    const isMember = await prisma.conversationParticipant.findFirst({
      where: { conversation_id: convoId, user_id: me.userId },
      select: { id: true },
    });
    if (!isMember) return new NextResponse("Forbidden", { status: 403 });

    const created = await prisma.$transaction(async (tx) => {
      // 1) Create anchor message (no text), tagged as DRIFT_ANCHOR in meta
      const anchor = await tx.message.create({
        data: {
          conversation_id: convoId,
          sender_id: userId,
          text: null,
          meta: { kind: "DRIFT_ANCHOR", title },
        },
        include: { sender: { select: { name: true, image: true } } },
      });

 // app/api/drifts/route.ts (classic drift)
const drift = await tx.drift.create({
  data: {
    conversation_id:   convoId,
    created_by:        userId,
    title:             String(title),
    kind:              "DRIFT",
    anchor_message_id: anchor.id, // ✅ required for DRIFT
  },
});
      
      // 3) Patch anchor meta with driftId
      await tx.message.update({
        where: { id: anchor.id },
        data: { meta: { kind: "DRIFT_ANCHOR", driftId: drift.id.toString(), title: String(title) } },
      });

      return { anchor, drift };
    });

    // Build anchor DTO (same shape as conversation message DTO + meta)
    const anchorDto = {
      id: created.anchor.id.toString(),
      conversationId: String(conversationId),
      text: null,
      createdAt: created.anchor.created_at.toISOString(),
      senderId: created.anchor.sender_id.toString(),
      sender: { name: created.anchor.sender?.name ?? null, image: created.anchor.sender?.image ?? null },
      attachments: [] as any[],
      isRedacted: false,
      meta: { kind: "DRIFT_ANCHOR", driftId: created.drift.id.toString(), title: created.drift.title },
      driftId: null, // anchor itself is not inside the drift
    };

    // Realtime notify room
    // await supabase
    //   .channel(`conversation-${String(conversationId)}`)
    //   .send({
    //     type: "broadcast",
    //     event: "drift_create",
    //     payload: jsonSafe({ anchor: anchorDto, drift: {
    //       id: created.drift.id.toString(),
    //       conversationId: String(conversationId),
    //       title: created.drift.title,
    //       isClosed: created.drift.is_closed,
    //       isArchived: created.drift.is_archived,
    //       messageCount: created.drift.message_count,
    //       lastMessageAt: created.drift.last_message_at ? created.drift.last_message_at.toISOString() : null,
    //       anchorMessageId: created.drift.anchor_message_id.toString(),
    //     }}),
    //   });

      await broadcast(`conversation-${String(conversationId)}`, "drift_create", {
        anchor: anchorDto,
        drift: {
          id: created.drift.id.toString(),
          conversationId: String(conversationId),
          title: created.drift.title,
          isClosed: created.drift.is_closed,
          isArchived: created.drift.is_archived,
          messageCount: created.drift.message_count,
          lastMessageAt: created.drift.last_message_at ? created.drift.last_message_at.toISOString() : null,
          anchorMessageId: created.drift.anchor_message_id?.toString() ?? null,
        },
      });

    return NextResponse.json(jsonSafe({ ok: true, anchor: anchorDto, drift: {
      id: created.drift.id.toString(),
      conversationId: String(conversationId),
      title: created.drift.title,
      isClosed: created.drift.is_closed,
      isArchived: created.drift.is_archived,
      messageCount: created.drift.message_count,
      lastMessageAt: created.drift.last_message_at ? created.drift.last_message_at.toISOString() : null,
      anchorMessageId: created.drift.anchor_message_id?.toString() ?? null,
    }}), { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/drifts] error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
