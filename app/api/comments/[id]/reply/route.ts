export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parent = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!parent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const userId = "anon"; // TODO auth
  const comment = await prisma.comment.create({
    data: { threadId: parent.threadId, body, createdBy: userId },
  });

  return NextResponse.json({
    id: comment.id,
    threadId: comment.threadId,
    body: comment.body,
    createdBy: comment.createdBy,
    createdAt: comment.createdAt.toISOString(),
    upvotes: comment.upvotes,
    downvotes: comment.downvotes,
  }, { status: 201 });
}
