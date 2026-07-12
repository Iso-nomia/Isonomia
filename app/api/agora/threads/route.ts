export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rel = url.searchParams.get("relation") || undefined; // 'discusses'|'cross-claim'|...
  const where: any = rel ? { relation: rel } : {};
  const rows = await prisma.xRef.findMany({
    where, orderBy: { createdAt: "desc" }, take: 100,
  });
  return NextResponse.json({ items: rows });
}
