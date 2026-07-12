export const dynamic = "force-dynamic";


 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 
 const bodySchema = z.object({
   messageId: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v as any)),
   conversationId: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v as any)),
   facetId: z.string().min(1),
   kind: z.enum(["APPROVE", "BLOCK", "CLEAR"]),
 });
 
 export async function POST(req: NextRequest) {
   const me = await getUserFromCookies();
   if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });
   const { messageId, conversationId, facetId, kind } = bodySchema.parse(await req.json());
 
   if (kind === "CLEAR") {
     await prisma.proposalSignal.deleteMany({ where: { facet_id: facetId, user_id: me.userId } });
   } else {
     await prisma.proposalSignal.upsert({
       where: { facet_id_user_id: { facet_id: facetId, user_id: me.userId } },
       update: { kind },
       create: { facet_id: facetId, message_id: messageId, conversation_id: conversationId, user_id: me.userId, kind },
     });
   }
 
   // Broadcast to room channel so UIs refresh proposal counts
    try {
        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        // You need the conversation id to address the right channel name
        await admin
          .channel(`conversation-${String(conversationId)}`)
          .send({
            type: "broadcast",
            event: "proposal_signal",
            payload: { rootMessageId: String(messageId), facetId, kind },
          });
      } catch (e) {
        console.warn("[rt] proposal_signal broadcast failed", e);
      }  
 
   return NextResponse.json({ ok: true });
 }
