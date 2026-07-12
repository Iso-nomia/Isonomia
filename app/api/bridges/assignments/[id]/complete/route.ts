export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { emitAmplificationEvent } from '@/lib/amplification/log';
import { writeLogbook } from '@/lib/governance/writers';

const CompleteSchema = z.object({
  summaryCardId: z.string(),
  completedById: z.string(), // must match assigneeId
  roomId: z.string(),
  hostType: z.enum(['article','post','room_thread','deliberation']).optional(),
  hostId: z.string().optional(),
  rewardCare: z.number().int().min(0).optional().default(0),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=> ({}));
  const p = CompleteSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const { summaryCardId, completedById, roomId, rewardCare, hostType, hostId } = p.data;

  // Guard: summary card must exist
  const card = await prisma.deliberationCard.findUnique({ where: { id: summaryCardId } });
  if (!card) return NextResponse.json({ error: 'card_not_found' }, { status: 404 });

  // Guard: assignment and assignee match; assignment -> request -> deliberation
  const assignment = await prisma.bridgeAssignment.findUnique({
    where: { id: params.id },
    include: { request: true },
  });
  if (!assignment) return NextResponse.json({ error: 'assignment_not_found' }, { status: 404 });
  if (assignment.assigneeId !== completedById) {
    return NextResponse.json({ error: 'not_assignee' }, { status: 403 });
  }
  if (card.deliberationId !== assignment.request.deliberationId) {
    return NextResponse.json({ error: 'card_wrong_deliberation' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.bridgeAssignment.update({
      where: { id: assignment.id },
      data: { completedAt: new Date(), summaryCardId, rewardCare },
    });
    await tx.bridgeRequest.update({
      where: { id: assignment.requestId },
      data: { status: 'completed' },
    });
  });

  // Amplification: bridge endorsement achieved
  await emitAmplificationEvent({
    deliberationId: assignment.request.deliberationId,
    hostType,
    hostId,
    eventType: 'bridge_endorsement',
    reason: 'Outside-cluster summary accepted',
    payload: { assignmentId: assignment.id, summaryCardId, rewardCare },
    createdById: completedById,
  });

  await writeLogbook({
    roomId,
    entryType: 'NOTE',
    summary: `Bridge summary accepted for deliberation ${assignment.request.deliberationId}`,
    payload: { requestId: assignment.requestId, assignmentId: assignment.id, summaryCardId },
  });

  return NextResponse.json({ ok: true });
}
