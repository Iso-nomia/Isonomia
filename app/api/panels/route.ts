export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { writeLogbook } from '@/lib/governance/writers';

const OpenSchema = z.object({
  roomId: z.string(),
  actorId: z.string(),
  panelistIds: z.array(z.string()).min(1),
  chairId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = OpenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { roomId, actorId, panelistIds, chairId } = parsed.data;
  const panel = await prisma.panel.create({
    data: { roomId },
  });

  await prisma.panelist.createMany({
    data: panelistIds.map(uid => ({
      panelId: panel.id,
      userId: uid,
      role: chairId && uid === chairId ? 'chair' : 'member',
    })),
  });

  await writeLogbook({
    roomId,
    entryType: 'PANEL_OPEN',
    summary: `Panel opened (${panelistIds.length} members)`,
    payload: { panelId: panel.id, openedBy: actorId, chairId: chairId ?? null },
  });

  return NextResponse.json({ ok: true, panelId: panel.id });
}
