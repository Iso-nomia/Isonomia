"use server";

import { prisma } from "@/lib/prismaclient";
import { supabase } from "@/lib/supabaseclient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadAttachment } from "@/lib/storage/uploadAttachment";
import { jsonSafe } from "../bigintjson";
import { extractUrls } from "@/lib/text/urls";
import { parseMentionsFromText } from "@/lib/text/mentions";
import { broadcast } from "@/lib/realtime/broadcast";
import { getOrFetchLinkPreview, hashUrl } from "@/lib/unfurl";

type SendMessageArgs = {
  senderId: bigint;
  conversationId: bigint;
  text?: string;
  files?: File[];
  driftId?: bigint;
  clientId?: string; // ← new
  meta?: any;             // ← NEW
};

export async function fetchMessages({
  conversationId,
  cursor,
  limit = 50,
}: {
  conversationId: bigint;
  cursor?: bigint;
  limit?: number;
}) {
  return prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit,
    include: { sender: true, attachments: true },
  });
}
export async function sendMessage({
  senderId,
  conversationId,
  text,
  files,
  driftId,
  clientId,
  meta,
}: SendMessageArgs) {
  if (!text && (!files || files.length === 0)) {
    throw new Error("Message must contain text or attachment");
  }

  // 1) DB transaction: create/reuse message, attachments, mentions, touch convo, drift counters
  const result = await prisma.$transaction(async (tx) => {
    // ensure participant
    const member = await tx.conversationParticipant.findFirst({
      where: { conversation_id: conversationId, user_id: senderId },
      select: { user_id: true },
    });
    if (!member) throw new Error("Not a participant in this conversation");


       // If a driftId is provided, validate it belongs to this conversation
       if (driftId) {
         const d = await tx.drift.findFirst({
           where: { id: driftId, conversation_id: conversationId },
           select: { id: true },
         });
         if (!d) throw new Error("Invalid driftId for this conversation");
       }

    // create or reuse (idempotency)
    let message:
      | Awaited<ReturnType<typeof tx.message.create>>
      | Awaited<ReturnType<typeof tx.message.findUnique>>;
    let createdNow = false;

    if (clientId) {
      const existing = await tx.message.findUnique({
        where: { conversation_id_client_id: { conversation_id: conversationId, client_id: clientId } },
        include: { sender: { select: { name: true, image: true } } },
      });
      if (existing) {
        message = existing;
          // 🩹 Repair: if caller passed driftId but reused row has no drift_id, set it now.
       if (driftId && !existing.drift_id) {
           message = await tx.message.update({
             where: { id: existing.id },
             data: { drift_id: driftId },
             include: { sender: { select: { name: true, image: true } } },
           });
         }
      } else {
        message = await tx.message.create({
          data: {
            sender_id: senderId,
            conversation_id: conversationId,
            text,
            drift_id: driftId ?? undefined,
            client_id: clientId,
            meta: meta ?? undefined,
          },
          include: { sender: { select: { name: true, image: true } } },
        });
        createdNow = true;
      }
    } else {
      message = await tx.message.create({
        data: {
          sender_id: senderId,
          conversation_id: conversationId,
          text,
          drift_id: driftId ?? undefined,
          meta: meta ?? undefined,
        },
        include: { sender: { select: { name: true, image: true } } },
      });
      createdNow = true;
    }

    // attachments on first creation only
    let attachments: { id: bigint; path: string; type: string; size: number }[] = [];
    if (createdNow && files?.length) {
      attachments = await Promise.all(
        files.map(async (f) => {
          const up = await uploadAttachment(f);
          return tx.messageAttachment.create({
            data: {
              message_id: message.id,
              path: up.path,
              type: up.type,
              size: up.size,
            },
          });
        })
      );
    }

    // mentions (plain text only) — inside txn
    if (message.text) {
      const tokens = await parseMentionsFromText(
        message.text,
        undefined,
        async (names) => {
          const users = await tx.user.findMany({
            where: { username: { in: names } },
            select: { id: true, username: true },
          });
          return users.map((u) => ({ id: u.id.toString(), username: u.username }));
        }
      );

      if (tokens.length) {
        const ids = tokens
          .map((t) => BigInt(t.userId))
          .filter((uid) => uid !== senderId);
        if (ids.length) {
          const participants = await tx.conversationParticipant.findMany({
            where: { conversation_id: conversationId, user_id: { in: ids } },
            select: { user_id: true },
          });
          const allowed = new Set(participants.map((p) => p.user_id.toString()));
          const rows = tokens
            .filter((t) => allowed.has(t.userId) && BigInt(t.userId) !== senderId)
            .map((t) => ({ messageId: message.id, facetId: null, userId: BigInt(t.userId) }));
          if (rows.length) {
            await tx.messageMention.createMany({ data: rows, skipDuplicates: true });
            // TODO optional: insert notifications here
          }
        }
      }
    }

    // collect URLs (we'll unfurl after commit)
    const urlList = extractUrls(message.text ?? "");

    // touch conversation
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updated_at: new Date() },
    });

    // drift counters (notify live). This can be inside txn (cheap) or after.
    if (createdNow && driftId) {
      const updated = await tx.drift.update({
        where: { id: driftId },
        data: { message_count: { increment: 1 }, last_message_at: new Date() },
        select: { id: true, conversation_id: true, message_count: true, last_message_at: true },
            });
      // supabase
      //   .channel(`conversation-${conversationId.toString()}`)
      //   .send({
      //     type: "broadcast",
      //     event: "drift_counters",
      //     payload: {
      //       driftId: driftId.toString(),
      //       messageCount: updated.message_count,
      //       lastMessageAt: updated.last_message_at?.toISOString() ?? null,
      //     },
      //   })
      //  // after updating drift counters in DB
try {
  await broadcast(`conversation-${message.conversation_id.toString()}`, "drift_counters", {
    driftId: driftId.toString(),
    messageCount: updated.message_count,
    lastMessageAt: updated.last_message_at?.toISOString() ?? null,
  });
} catch (e) {
  console.error("[broadcast] drift_counters failed", e);
}

    }

    return { message, createdNow, attachments, urlList };
  });

  const { message, createdNow, attachments, urlList } = result;

  // 2) Broadcast new_message once (on first creation)
  if (createdNow) {
    const topic = `conversation-${message.conversation_id.toString()}`;
    const payload = {
      id: message.id.toString(),
      conversationId: message.conversation_id.toString(),
      text: message.text ?? null,
      createdAt: message.created_at.toISOString(),
      senderId: message.sender_id.toString(),
      driftId: message.drift_id ? message.drift_id.toString() : null,
      clientId: clientId ?? null,
      sender: { name: (message as any).sender?.name ?? null, image: (message as any).sender?.image ?? null },
      attachments: attachments.map((a) => ({
        id: a.id.toString(),
        path: a.path,
        type: a.type,
        size: a.size,
      })),
    };
  
    try {
      await broadcast(topic, "new_message", payload);
    } catch (e) {
      console.error("[broadcast] new_message failed", e);
    }
  }
  
  
  // 3) Post-commit unfurl (warm cache) and patch open clients
  if (createdNow && Array.isArray(urlList) && urlList.length) {
    for (const url of urlList.slice(0, 8)) {
      getOrFetchLinkPreview(url)
        .then(() =>
          supabase
            .channel(`conversation-${message.conversation_id.toString()}`)
            .send({
              type: "broadcast",
              event: "link_preview_update",
              payload: { messageId: message.id.toString(), urlHash: hashUrl(url) },
            })
            .catch(() => {})
        )
        .catch(() => {});
    }
  }

  // 4) Return the same shape ChatRoom expects (client hydrates later anyway)
  return jsonSafe({
    id: message.id.toString(),
    conversationId: message.conversation_id.toString(),
    text: message.text ?? null,
    createdAt: message.created_at.toISOString(),
    senderId: message.sender_id.toString(),
    driftId: message.drift_id ? message.drift_id.toString() : null,
    clientId: clientId ?? null,
    attachments: [] as any[],
  });
}

     