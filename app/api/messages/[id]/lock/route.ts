// app/api/messages/[id]/lock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v)) });

async function canLock(messageId: bigint, userId: bigint) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { sender_id: true, conversation_id: true },
  });
  if (!msg) return false;
  if (msg.sender_id === userId) return true;

  const part = await prisma.conversationParticipant.findFirst({
    where: { conversation_id: msg.conversation_id, user_id: userId },
    select: { /* adjust to your schema */ role: true } as any,
  });
  const role = (part as any)?.role as string | undefined;
  return !!role && ["ADMIN", "MOD", "OWNER"].includes(role.toUpperCase());
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromCookies();
  if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id: messageId } = paramsSchema.parse(params);

  if (!(await canLock(messageId, me.userId))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // idempotent: if lock exists, just return it
  const existing = await prisma.agreementLock.findUnique({ where: { message_id: messageId } });
  if (existing) {
    return NextResponse.json({ ok: true, lock: existing, already: true });
  }

  const lock = await prisma.agreementLock.create({
    data: { message_id: messageId, locked_by: me.userId },
  });

  // Optional: system note / broadcast could be emitted here
  return NextResponse.json({ ok: true, lock });
}
