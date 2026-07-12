export const dynamic = "force-dynamic";

// app/api/me/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookies, getCurrentUserId, getCurrentUserAuthId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { jsonSafe } from "@/lib/bigintjson";

export async function GET() {
  // Cookie path (web sessions) — fast path with full user shape.
  const user = await getUserFromCookies();
  if (user) {
    return NextResponse.json(jsonSafe({
      uid: user.uid,
      userId: user.userId,
      email: user.email,
      name: user.displayName,
    }), { headers: { "Cache-Control": "no-store" } });
  }

  // Bearer fallback (Chrome extension, bot agents, API clients).
  const [userId, uid] = await Promise.all([getCurrentUserId(), getCurrentUserAuthId()]);
  if (!userId || !uid) return NextResponse.json(null, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  return NextResponse.json(jsonSafe({
    uid,
    userId: userId.toString(),
    email: null,
    name: u?.name ?? u?.username ?? null,
  }), { headers: { "Cache-Control": "no-store" } });
}
