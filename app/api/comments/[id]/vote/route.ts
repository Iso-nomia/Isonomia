export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { delta } = await req.json();
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta must be +1 or -1" }, { status: 400 });
  }
  const updated = await prisma.comment.update({
    where: { id: params.id },
    data: delta === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
    select: { id: true, upvotes: true, downvotes: true },
  });
  return NextResponse.json(updated);
}
