import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { discussionId: string; commentId: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const id = BigInt(params.commentId);
  const body = await req.json().catch(() => ({}));
  let dir = Number(body?.dir ?? 0);
  if (![-1, 0, 1].includes(dir)) dir = 0;

  // Upsert user's vote
  await prisma.forumVote.upsert({
    where: { userId_commentId: { userId: uid, commentId: id } },
    update: { dir },
    create: { userId: uid, commentId: id, dir },
  });

  // Recompute total score (summed votes)
  const agg = await prisma.forumVote.aggregate({
    where: { commentId: id },
    _sum: { dir: true },
  });
  const newScore = Number(agg._sum.dir ?? 0);

  await prisma.forumComment.update({
    where: { id },
    data: { score: newScore },
  });

  return NextResponse.json({ ok: true, vote: dir, score: newScore });
}
