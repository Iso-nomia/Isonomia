export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { jsonSafe } from "@/lib/bigintjson";

const querySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { unreadOnly } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );

  const notifications = await prisma.notification.findMany({
    where: {
      user_id: user.userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { created_at: "desc" },
    take: 50,
    include: { actor: true, market: true, trade: true },
  });

  return NextResponse.json(jsonSafe(notifications));
}
