//app/api/discussions/[id]/forum/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const revalidate = 0;

// GET /api/discussions/:id/forum/me?ids=1,2,3
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return NextResponse.json({ ok: true, votes: {}, saves: {} });

  const idsBig = ids.map((s) => BigInt(s));

  const votes = await prisma.forumVote.findMany({
    where: { userId: uid, commentId: { in: idsBig } },
    select: { commentId: true, dir: true },
  });
  const saves = await prisma.forumSave.findMany({
    where: { userId: uid, commentId: { in: idsBig } },
    select: { commentId: true },
  });

  const voteMap: Record<string, number> = {};
  for (const v of votes) voteMap[String(v.commentId)] = v.dir;

  const saveMap: Record<string, boolean> = {};
  for (const s of saves) saveMap[String(s.commentId)] = true;

  return NextResponse.json({ ok: true, votes: voteMap, saves: saveMap });
}
