export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export async function GET() {
  const u = await getUserFromCookies();
  if (!u || u.userId == null) return NextResponse.json({ items: [] });
  const rows = await prisma.stackSubscription.findMany({
    where: { user_id: BigInt(u.userId) },
    select: { stack_id: true },
  });
  return NextResponse.json({ items: rows.map(r => r.stack_id) });
}
