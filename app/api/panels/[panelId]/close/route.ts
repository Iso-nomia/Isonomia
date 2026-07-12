export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { writeLogbook } from '@/lib/governance/writers';

export async function POST(_: NextRequest, { params }: { params: { panelId: string } }) {
  const panel = await prisma.panel.update({
    where: { id: params.panelId },
    data: { closedAt: new Date() },
  });
  await writeLogbook({
    roomId: panel.roomId,
    entryType: 'PANEL_CLOSE',
    summary: `Panel closed`,
    payload: { panelId: panel.id },
  });
  return NextResponse.json({ ok: true });
}
