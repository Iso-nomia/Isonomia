export const dynamic = "force-dynamic";

// app/api/conversations/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { user_id: user.userId } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, image: true } } } },
      messages: { orderBy: { created_at: "desc" }, take: 1, select: { text: true, created_at: true } },
    },
    orderBy: { updated_at: "desc" },
    take: 50,
  });

  // JSON-safe mapping
  const list = rows.map((c) => ({
    id: c.id.toString(),
    isGroup: c.is_group,
    title: c.title,
    participants: c.participants.map((p) => ({
      id: p.user.id.toString(),
      name: p.user.name,
      image: p.user.image,
    })),
    lastMessage: c.messages[0]?.text ?? null,
    lastAt: c.messages[0]?.created_at?.toISOString() ?? null,
  }));

  return NextResponse.json(list, { status: 200 });
}
