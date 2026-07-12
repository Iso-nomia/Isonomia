export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { writeLogbook } from '@/lib/governance/writers';

const AssignSchema = z.object({
  assigneeId: z.string(),
  assignedById: z.string(),
  roomId: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=> ({}));
  const p = AssignSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const { assigneeId, assignedById, roomId } = p.data;
  const request = await prisma.bridgeRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Outside-cluster sanity check (simple): assignee must NOT be in targetClusterId
  const inCluster = await prisma.userCluster.findFirst({
    where: { userId: assigneeId, clusterId: request.targetClusterId },
  });
  if (inCluster) return NextResponse.json({ error: 'assignee_in_target_cluster' }, { status: 400 });

  const assignment = await prisma.$transaction(async (tx) => {
    const a = await tx.bridgeAssignment.create({
      data: { requestId: request.id, assigneeId },
    });
    await tx.bridgeRequest.update({
      where: { id: request.id },
      data: { status: 'assigned' },
    });
    return a;
  });

  await writeLogbook({
    roomId,
    entryType: 'NOTE',
    summary: `Bridge assigned to user ${assigneeId}`,
    payload: { requestId: request.id, assignmentId: assignment.id },
  });

  return NextResponse.json({ ok: true, assignmentId: assignment.id });
}
