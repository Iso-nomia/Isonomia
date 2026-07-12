export const dynamic = "force-dynamic";

// app/api/content-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

const Q = z.object({
  targetType: z.string().min(1),
  targetId:   z.string().min(1),
  roomId:     z.string().optional().nullable(), // optional
});

export async function GET(req: NextRequest) {
  const qs = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Q.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { targetType, targetId, roomId } = parsed.data;

  // Use findFirst when roomId is null (unique constraint requires non-null roomId)
  let row = roomId && typeof roomId === "string"
    ? await prisma.contentStatus.findUnique({
        where: {
          roomId_targetType_targetId: {
            roomId,
            targetType: targetType as any,
            targetId,
          },
        },
      }).catch(async () => {
        return prisma.contentStatus.findFirst({
          where: { targetType: targetType as any, targetId, roomId },
          orderBy: { createdAt: "desc" },
        });
      })
    : await prisma.contentStatus.findFirst({
        where: { targetType: targetType as any, targetId, roomId: null },
        orderBy: { createdAt: "desc" },
      });

  return NextResponse.json({ ok: true, status: row?.currentStatus ?? "OK" }, { headers: { "Cache-Control": "no-store" } });
}
