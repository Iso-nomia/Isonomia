export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

// app/api/users/search/route.ts
import { getUserFromCookies } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });
  const q = req.nextUrl.searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([], { status: 200 });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, username: true, image: true },
    take: 10,
  });

  return NextResponse.json(
    users.map(u => ({
      id: u.id.toString(),
      name: u.name,
      username: u.username,
      image: u.image,
    })),
    { status: 200 }
  );
}