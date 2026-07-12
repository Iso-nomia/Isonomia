export const dynamic = "force-dynamic";

//app/api/propositions/[id]/vote/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: NextRequest, { params }: { params:{ id:string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...NO_STORE });

  const id = params.id;
  const b = await req.json().catch(()=>({}));
  let value = Number(b?.value ?? 0);
  if (![ -1, 0, 1 ].includes(value)) value = 0;

  const out = await prisma.$transaction(async (tx) => {
    const prop = await tx.proposition.findUnique({ where: { id }, select: { id:true } });
    if (!prop) throw new Error('Not found');

    const prev = await tx.propositionVote.findUnique({ where: { propositionId_userId: { propositionId: id, userId: String(userId) } } });

    // Compute deltas (up/down counts)
    const oldVal = prev?.value ?? 0;
    const newVal = value;

    const upDelta   = (newVal ===  1 ? 1 : 0) - (oldVal ===  1 ? 1 : 0);
    const downDelta = (newVal === -1 ? 1 : 0) - (oldVal === -1 ? 1 : 0);

    // Persist vote row
    if (newVal === 0) {
      if (prev) await tx.propositionVote.delete({ where: { propositionId_userId: { propositionId: id, userId: String(userId) } } });
    } else {
      await tx.propositionVote.upsert({
        where: { propositionId_userId: { propositionId: id, userId: String(userId) } },
        update: { value: newVal },
        create: { propositionId: id, userId: String(userId), value: newVal }
      });
    }

    // Update counters
    const updated = await tx.proposition.update({
      where: { id },
      data: {
        voteUpCount:   { increment: upDelta },
        voteDownCount: { increment: downDelta },
      },
      select: { voteUpCount: true, voteDownCount: true }
    });

    return { viewerVote: newVal, voteUpCount: updated.voteUpCount, voteDownCount: updated.voteDownCount };
  });

  return NextResponse.json({ ok:true, ...out }, NO_STORE);
}
