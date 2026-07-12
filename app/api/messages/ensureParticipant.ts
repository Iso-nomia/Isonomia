import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";

export async function ensureParticipant(
  req: NextRequest,
  conversationId: bigint
): Promise<{ userId: bigint } | NextResponse> {
  const user = await getUserFromCookies();
  if (!user?.userId)
    return new NextResponse("Unauthorized", { status: 401 });

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId },
    select: {
      id: true,
      participants: { where: { user_id: user.userId }, select: { user_id: true } },
    },
  });
  if (!conversation) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (conversation.participants.length === 0) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return { userId: user.userId };
}
