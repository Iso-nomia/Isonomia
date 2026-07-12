export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const updated = await prisma.commentThread.update({
    where: { id: params.id },
    data: { resolved: true },
    select: { id: true, resolved: true },
  });
  return NextResponse.json(updated);
}
