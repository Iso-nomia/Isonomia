export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { emitBus } from '@/lib/server/bus';

const Body = z.object({
  approvals: z.record(z.boolean()).optional(), // approval
  ranking: z.array(z.string().min(1)).optional(), // rcv
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await prisma.voteSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.closedAt) return NextResponse.json({ error: 'Closed' }, { status: 400 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.voteBallot.upsert({
    where: { sessionId_voterId: { sessionId: params.id, voterId: String(userId) } },
    update: { approvalsJson: parsed.data.approvals ?? undefined, rankingJson: parsed.data.ranking ?? undefined },
    create: { sessionId: params.id, voterId: String(userId), approvalsJson: parsed.data.approvals ?? undefined, rankingJson: parsed.data.ranking ?? undefined },
  });

  emitBus('votes:changed', { deliberationId: session.deliberationId, sessionId: session.id });
  return NextResponse.json({ ok: true });
}
