export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { writeDecisionReceipt, writeLogbook } from '@/lib/governance/writers';

const Schema = z.object({
  roomId: z.string(),
  actorId: z.string(),
  targetType: z.enum([
    'article','post','room_thread','deliberation','argument','card','claim','brief','brief_version'
  ]),
  targetId: z.string(),
  newStatus: z.enum([
    'OK','NEEDS_SOURCES','WORKSHOP','OFF_TOPIC_REDIRECT','DUPLICATE_MERGE','DISPUTED','OUT_OF_BOUNDS'
  ]),
  reason: z.string().optional(),
  panelId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { roomId, actorId, targetType, targetId, newStatus, reason, panelId } = parsed.data;

  // Upsert current content status
  const existing = await prisma.contentStatus.findUnique({
    where: { roomId_targetType_targetId: { roomId, targetType, targetId } },
  });

  const updated = await prisma.contentStatus.upsert({
    where: { roomId_targetType_targetId: { roomId, targetType, targetId } },
    create: {
      roomId,
      targetType,
      targetId,
      currentStatus: newStatus as any,
      prevStatus: null,
      reason: reason ?? null,
      decidedById: actorId,
      panelId: panelId ?? null,
    },
    update: {
      prevStatus: existing?.currentStatus ?? null,
      currentStatus: newStatus as any,
      reason: reason ?? null,
      decidedById: actorId,
      panelId: panelId ?? null,
      createdAt: new Date(), // bump timestamp (acts like an event marker)
    },
  });

  await writeDecisionReceipt({
    roomId, actorId,
    action: 'STATUS_CHANGE',
    reason: reason ?? null,
    targetType, targetId,
    panelId: panelId ?? null,
  });

  await writeLogbook({
    roomId,
    entryType: 'STATUS_CHANGE',
    summary: `Status → ${newStatus} for ${targetType}:${targetId}`,
    payload: { targetType, targetId, newStatus, prevStatus: updated.prevStatus, panelId: panelId ?? null },
  });

  return NextResponse.json({ ok: true, status: updated });
}
