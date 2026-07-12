export const dynamic = "force-dynamic";

 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 
 const paramsSchema = z.object({ id: z.coerce.bigint() });
 const bodySchema = z.object({
   label: z.string().trim().max(120).optional().nullable(),
 });
 
 async function ensureAccess(conversationId: bigint, userId: bigint) {
   const part = await prisma.conversationParticipant.findFirst({
     where: { conversation_id: conversationId, user_id: userId },
     select: { user_id: true },
   });
   if (part) return true;
   const dm = await prisma.conversation.findUnique({
     where: { id: conversationId },
     select: { user1_id: true, user2_id: true },
   });
   return !!dm && (dm.user1_id === userId || dm.user2_id === userId);
 }
 
 export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
   const me = await getUserFromCookies();
   if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
   const { id: messageId } = paramsSchema.parse(ctx.params);
   const { label } = bodySchema.parse(await req.json().catch(() => ({})));
 
   const msg = await prisma.message.findUnique({
     where: { id: messageId },
     select: { id: true, conversation_id: true },
   });
   if (!msg) return new NextResponse("Not Found", { status: 404 });
 
   const ok = await ensureAccess(msg.conversation_id, me.userId);
   if (!ok) return new NextResponse("Forbidden", { status: 403 });
 
   const bk = await prisma.bookmark.upsert({
     where: { user_id_message_id: { user_id: me.userId, message_id: messageId } },
     update: { label: label ?? null },
     create: { user_id: me.userId, message_id: messageId, label: label ?? null },
     select: { id: true, label: true },
   });
   return NextResponse.json({ status: "ok", id: bk.id.toString(), label: bk.label ?? null });
 }
 
 export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
   const me = await getUserFromCookies();
   if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
   const { id: messageId } = paramsSchema.parse(ctx.params);
 
   await prisma.bookmark.deleteMany({
     where: { user_id: me.userId, message_id: messageId },
   });
   return NextResponse.json({ status: "ok" });
 }
 