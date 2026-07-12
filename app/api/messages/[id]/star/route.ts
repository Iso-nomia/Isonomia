export const dynamic = "force-dynamic";

 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 
 const paramsSchema = z.object({ id: z.coerce.bigint() });
 
 async function ensureAccess(conversationId: bigint, userId: bigint) {
   // prefer participants
   const part = await prisma.conversationParticipant.findFirst({
     where: { conversation_id: conversationId, user_id: userId },
     select: { user_id: true },
   });
   if (part) return true;
   // fallback to DM tuple
   const dm = await prisma.conversation.findUnique({
     where: { id: conversationId },
     select: { user1_id: true, user2_id: true },
   });
   return !!dm && (dm.user1_id === userId || dm.user2_id === userId);
 }
 
 export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
   const me = await getUserFromCookies();
   if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
 
   const { id: messageId } = paramsSchema.parse(ctx.params);
 
   const msg = await prisma.message.findUnique({
     where: { id: messageId },
     select: { id: true, conversation_id: true },
   });
   if (!msg) return new NextResponse("Not Found", { status: 404 });
 
   const ok = await ensureAccess(msg.conversation_id, me.userId);
   if (!ok) return new NextResponse("Forbidden", { status: 403 });
 
   // toggle: delete if exists else create
   const del = await prisma.messageStar.deleteMany({
     where: { user_id: me.userId, message_id: messageId },
   });
   if (del.count > 0) {
     return NextResponse.json({ starred: false });
   }
   await prisma.messageStar.create({
     data: { user_id: me.userId, message_id: messageId },
   });
   return NextResponse.json({ starred: true });
 }
 