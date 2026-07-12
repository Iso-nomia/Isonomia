import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const runtime = "nodejs";

const q = z.object({
  rootMessageId: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((v) => BigInt(v as any)),
  limit: z.coerce.number().min(1).max(100).default(100),
});

function ok(items: any[]) {
  return NextResponse.json({ items });
}

export async function GET(req: NextRequest) {
  const me = await getUserFromCookies();
  if (!me?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { rootMessageId, limit } = q.parse(Object.fromEntries(searchParams));

  // 1) Root message + conversation
  const root = await prisma.message.findUnique({
    where: { id: rootMessageId },
    select: { id: true, conversation_id: true },
  });
  if (!root) return ok([]); // 200 empty rather than 404 to avoid UI error

  // 2) Membership: participant OR DM tuple fallback
  const part = await prisma.conversationParticipant.findFirst({
    where: { conversation_id: root.conversation_id, user_id: me.userId },
    select: { user_id: true },
  });
  let member = !!part;
  if (!member) {
    const dm = await prisma.conversation.findUnique({
      where: { id: root.conversation_id },
      select: { user1_id: true, user2_id: true },
    });
    member =
      !!dm &&
      (String(dm.user1_id) === String(me.userId) ||
        String(dm.user2_id) === String(me.userId));
  }
  if (!member) return ok([]); // treat as empty list rather than 403

  // 3) Find the shared PROPOSAL drift (if none yet, return empty)
  const drift = await prisma.drift.findFirst({
    where: {
      conversation_id: root.conversation_id,
      root_message_id: root.id,
      kind: "PROPOSAL" as any,
    },
    select: { id: true },
  });
  if (!drift) return ok([]); // proposals not started yet

  // 4) Fetch candidate messages in that drift
  //    Keep this robust and text-first; facet preview can be added later.
  const msgs = await prisma.message.findMany({
    where: {
      drift_id: drift.id,
      is_redacted: false,
      text: { not: null }, // only text candidates for robustness
    } as any,
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      id: true,
      text: true,
      created_at: true,
      sender_id: true,
      sender: { select: { id: true, name: true } },
    },
  });

  const items = msgs.map((m) => ({
    kind: "TEXT",
    messageId: m.id.toString(),
    authorId: m.sender_id.toString(),
    authorName: m.sender?.name ?? `User ${m.sender_id}`,
    createdAt: (m as any).created_at,
    previewTitle: "Text",
    preview: (m.text || "").slice(0, 200),
  }));

  return ok(items);
}

