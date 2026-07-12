export const dynamic = "force-dynamic";

// app/api/stacks/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const idOrSlug = url.searchParams.get("id") || url.searchParams.get("slug");
  if (!idOrSlug) return NextResponse.json({ error: "id or slug required" }, { status: 400 });

  const stack = await prisma.stack.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: {
      id: true, name: true, is_public: true, slug: true,
      _count: { select: { subscribers: true, posts: true } },
    },
  });
  if (!stack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: stack.id,
    name: stack.name,
    is_public: stack.is_public,
    slug: stack.slug,
    subscribers: stack._count.subscribers,
    items: stack._count.posts,
  });
}
