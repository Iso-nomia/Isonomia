export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

/**
 * GET /api/users/batch?ids=id1,id2,id3
 * Fetch multiple users by their IDs
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam?.trim()) {
    return NextResponse.json({ ok: true, users: [] }, { status: 200 });
  }

  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, users: [] }, { status: 200 });
  }

  try {
    // Convert string IDs to BigInt
    const bigIntIds = ids.map((id) => {
      try {
        return BigInt(id);
      } catch {
        return null;
      }
    }).filter((id): id is bigint => id !== null);

    if (bigIntIds.length === 0) {
      return NextResponse.json({ ok: true, users: [] }, { status: 200 });
    }

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: bigIntIds,
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        users: users.map((u) => ({
          id: String(u.id),
          name: u.name,
          username: u.username,
          image: u.image,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching users batch:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
