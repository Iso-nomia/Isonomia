export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { writeDecisionReceipt, writeLogbook } from '@/lib/governance/writers';

const DecideSchema = z.object({
  roomId: z.string(),
  actorId: z.string(), // panelist id making the call (server should check eligibility)
  targetType: z.enum(['article','post','room_thread','deliberation','argument','card','claim','brief','brief_version']),
  targetId: z.string(),
  decision: z.enum(['APPROVE','WORKSHOP','REDIRECT']),
  reason: z.string().optional(),
});

function mapDecisionToStatus(decision: 'APPROVE'|'WORKSHOP'|'REDIRECT') {
  switch (decision) {
    case 'APPROVE': return 'OK';
    case 'WORKSHOP': return 'WORKSHOP';
    case 'REDIRECT': return 'OFF_TOPIC_REDIRECT';
  }
}

export async function POST(req: NextRequest, { params }: { params: { panelId: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = DecideSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { roomId, actorId, targetType, targetId, decision, reason } = parsed.data;

  const newStatus = mapDecisionToStatus(decision);

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
      panelId: params.panelId,
    },
    update: {
      prevStatus: existing?.currentStatus ?? null,
      currentStatus: newStatus as any,
      reason: reason ?? null,
      decidedById: actorId,
      panelId: params.panelId,
      createdAt: new Date(),
    },
  });

  await writeDecisionReceipt({
    roomId, actorId,
    action: 'PANEL_DECISION',
    reason: reason ?? null,
    targetType, targetId,
    panelId: params.panelId,
  });

  await writeLogbook({
    roomId,
    entryType: 'PANEL_DECISION',
    summary: `Panel: ${decision} → ${targetType}:${targetId}`,
    payload: { panelId: params.panelId, decision, newStatus, prevStatus: updated.prevStatus, reason: reason ?? null },
  });

  return NextResponse.json({ ok: true, status: updated });
}
