// app/api/messages/[id]/ack/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const runtime = "nodejs";
const paramsSchema = z.object({ id: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v)) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromCookies();
  if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
  const { id: messageId } = paramsSchema.parse(params);

  // Require a lock
  const lock = await prisma.agreementLock.findUnique({ where: { message_id: messageId } });
  if (!lock) return new NextResponse("No lock for message", { status: 400 });

  // Optional: ensure participant of the conversation
  const msg = await prisma.message.findUnique({
    where: { id: messageId }, select: { conversation_id: true }
  });
  if (!msg) return new NextResponse("Not found", { status: 404 });

  const part = await prisma.conversationParticipant.findFirst({
    where: { conversation_id: msg.conversation_id, user_id: me.userId },
    select: { user_id: true },
  });
  if (!part) return new NextResponse("Forbidden", { status: 403 });

  // Upsert ack
  await prisma.agreementAck.upsert({
    where: { message_id_user_id: { message_id: messageId, user_id: me.userId } },
    update: { ack_at: new Date() as any },
    create: { message_id: messageId, user_id: me.userId },
  });

  // Return coverage
  const total = await prisma.conversationParticipant.count({
    where: { conversation_id: msg.conversation_id },
  });
  const acks = await prisma.agreementAck.count({ where: { message_id: messageId } });

  return NextResponse.json({ ok: true, acks, total });
}
