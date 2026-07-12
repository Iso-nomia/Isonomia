export const dynamic = "force-dynamic";

// app/api/library/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const typeFilter = url.searchParams.get("type");
  const recent = url.searchParams.get("recent") === "true";
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10),
    50
  );

  // Build where clause
  const where: Record<string, unknown> = {
    uploader_id: user.userId ? BigInt(user.userId) : undefined,
  };

  // Text search across multiple fields
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { linkTitle: { contains: q, mode: "insensitive" } },
      { linkUrl: { contains: q, mode: "insensitive" } },
      { linkSiteName: { contains: q, mode: "insensitive" } },
    ];
  }

  // Block type filter
  if (typeFilter && ["pdf", "link", "text", "image", "video"].includes(typeFilter)) {
    where.blockType = typeFilter;
  }

  const rows = await prisma.libraryPost.findMany({
    where,
    take: limit,
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      title: true,
      file_url: true,
      thumb_urls: true,
      stack_id: true,
      blockType: true,
      created_at: true,
      linkUrl: true,
      linkTitle: true,
      linkSiteName: true,
      linkImage: true,
      linkFavicon: true,
      imageUrl: true,
      videoThumb: true,
      stack: {
        select: { name: true },
      },
    },
  });

  // Format response - convert BigInt ids to strings
  const items = rows.map((row) => ({
    ...row,
    id: row.id.toString(),
    stack_id: row.stack_id?.toString() ?? null,
    created_at: row.created_at?.toISOString() ?? null,
  }));

  return NextResponse.json({ items, recent });
}
