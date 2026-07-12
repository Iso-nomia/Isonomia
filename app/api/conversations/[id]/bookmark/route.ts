export const dynamic = "force-dynamic";

 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 import { jsonSafe } from "@/lib/bigintjson";
 
 const paramsSchema = z.object({ id: z.coerce.bigint() });
 
 async function isParticipant(conversationId: bigint, userId: bigint) {
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
 
 export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
   const me = await getUserFromCookies();
   if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
   const { id: conversationId } = paramsSchema.parse(ctx.params);
 
   if (!(await isParticipant(conversationId, me.userId)))
     return new NextResponse("Forbidden", { status: 403 });
 
   const rows = await prisma.bookmark.findMany({
     where: {
       user_id: me.userId,
       message: { conversation_id: conversationId },
     },
     select: { message_id: true, label: true, created_at: true },
     orderBy: { created_at: "desc" },
     take: 1000,
   });
   return NextResponse.json(jsonSafe({ items: rows }));
 }