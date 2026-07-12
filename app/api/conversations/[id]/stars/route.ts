export const dynamic = "force-dynamic";

 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 import { jsonSafe } from "@/lib/bigintjson";
 
 const paramsSchema = z.object({ id: z.coerce.bigint() });
 
 export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
   const me = await getUserFromCookies();
   if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
   const { id: conversationId } = paramsSchema.parse(ctx.params);
 
   // Return ids of messages starred by current user within this conversation
   const rows = await prisma.messageStar.findMany({
     where: {
       user_id: me.userId,
       message: { conversation_id: conversationId },
     },
     select: { message_id: true, created_at: true },
     orderBy: { created_at: "desc" },
     take: 500, // reasonable upper bound; adjust if needed
   });
 
   const ids = rows.map((r) => r.message_id);
   return NextResponse.json(jsonSafe({ ids, count: rows.length }));
 }
 