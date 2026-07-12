import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Q = z.object({
  from: z.string().min(6),
  to: z.string().min(6),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const { from, to } = Q.parse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });

  const row = await prisma.roomFunctor.findFirst({
    where: { fromRoomId: from, toRoomId: to },
    select: { id: true, fromRoomId: true, toRoomId: true, claimMapJson: true, notes: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    mapping: row ?? { id: null, fromRoomId: from, toRoomId: to, claimMapJson: {}, notes: null },
  }, { headers: { "Cache-Control": "no-store" }});
}
