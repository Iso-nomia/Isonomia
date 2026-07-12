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
  const saved = !!body?.saved;

  if (saved) {
    await prisma.forumSave.upsert({
      where: { userId_commentId: { userId: uid, commentId: id } },
      update: {},
      create: { userId: uid, commentId: id },
    });
  } else {
    await prisma.forumSave.deleteMany({ where: { userId: uid, commentId: id } });
  }

  return NextResponse.json({ ok: true, saved });
}
