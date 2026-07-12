export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

// Same tiny helper as above if you want to protect it
async function requireUserId(req: NextRequest): Promise<bigint | null> {
  try {
    const mod = await import("@/lib/serverutils");
    const me = await mod.getUserFromCookies?.();
    if (me?.userId) return BigInt(me.userId);
  } catch {}
  const hdr = req.headers.get("x-user-id");
  return hdr ? BigInt(hdr) : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireUserId(req);
  if (!me) return new NextResponse("Unauthorized", { status: 401 });

  const conversationId = BigInt(params.id);

  const states = await prisma.conversationState.findMany({
    where: { conversationId },
    select: { userId: true, lastReadAt: true },
  });

  return NextResponse.json({
    ok: true,
    items: states.map(s => ({
      userId: s.userId.toString(),
      lastReadAt: s.lastReadAt.toISOString(),
    })),
  });
}
