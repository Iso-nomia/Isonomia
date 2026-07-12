export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { supabase } from "@/lib/supabaseclient";

// Replace this with your auth util
async function requireUserId(req: NextRequest): Promise<bigint | null> {
  try {
    const mod = await import("@/lib/serverutils"); // optional
    const me = await mod.getUserFromCookies?.();
    if (me?.userId) return BigInt(me.userId);
  } catch {}
  const hdr = req.headers.get("x-user-id");
  return hdr ? BigInt(hdr) : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUserId(req);
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const conversationId = BigInt(params.id);
  const now = new Date();

  await prisma.conversationState.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: { lastReadAt: now },
    create: { conversationId, userId, lastReadAt: now },
  });

  // Let others update "Seen by"
  supabase.channel(`conversation-${params.id}`).send({
    type: "broadcast",
    event: "read",
    payload: { userId: userId.toString(), ts: now.toISOString() },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
