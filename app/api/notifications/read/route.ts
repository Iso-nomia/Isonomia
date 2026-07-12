export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

const bodySchema = z.object({
  ids: z.array(z.coerce.bigint()),
});

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { ids } = bodySchema.parse(await req.json());

  await prisma.notification.updateMany({
    where: { id: { in: ids }, user_id: user.userId },
    data: { read: true },
  });

  return NextResponse.json({ status: "ok" });
}
