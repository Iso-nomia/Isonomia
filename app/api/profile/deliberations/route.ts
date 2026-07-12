export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  const u = await getUserFromCookies();
  if (!u) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "15", 10), 1), 100);
  const q = (url.searchParams.get("q") || "").trim();
  const host = (url.searchParams.get("host") || "").trim();

  const where: any = { createdById: String(u.userId) };
  if (host) where.hostType = host as any;

  // (Optional) If you later add 'title' or 'tags', extend OR filter here.
  const [total, rows] = await Promise.all([
    prisma.deliberation.count({ where }),
    prisma.deliberation.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, hostType: true, hostId: true, createdAt: true },
    }),
  ]);

  const items = rows.map(r => ({
    id: r.id,
    hostType: String(r.hostType),
    hostId: r.hostId,
    createdAt: r.createdAt.toISOString(),
    title: null,
    tags: [],
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
