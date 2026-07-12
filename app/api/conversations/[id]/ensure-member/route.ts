// app/api/conversations/[id]/ensure-member/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Handle demo/non-numeric conversation IDs gracefully
  if (params.id.startsWith("demo-") || isNaN(Number(params.id))) {
    // Skip database operations for demo conversations
    return NextResponse.json({ ok: true, demo: true });
  }

  const convId = BigInt(params.id);

  try {
    // If you have a composite unique index on (conversation_id, user_id),
    // upsert is ideal. If not, the create() below will suffice.
    await (prisma as any).conversationParticipant.upsert({
      where: {
        conversation_id_user_id: { conversation_id: convId, user_id: uid },
      },
      update: {},
      create: {
        conversation_id: convId,
        user_id: uid,
        joined_at: new Date(), // ← optional if you have it
        // NOTE: no `role` here; your model does not support it
      },
    });
  } catch (e: any) {
    // Fallback if you don't have that composite unique
    try {
      await (prisma as any).conversationParticipant.create({
        data: {
          conversation_id: convId,
          user_id: uid,
          joined_at: new Date(), // optional
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") {
        console.warn("[ensure-member] create failed:", err?.code || err);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
