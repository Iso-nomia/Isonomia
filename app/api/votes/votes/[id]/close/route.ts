export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import bus from '@/lib/server/bus';
import { createDecisionReceipt } from '@/lib/decisions/createReceipt';

function tallyApproval(options: {id:string}[], ballots: any[]) {
  const counts: Record<string, number> = Object.fromEntries(options.map(o=>[o.id,0]));
  for (const b of ballots) {
    const a = (b.approvalsJson ?? {}) as Record<string, boolean>;
    for (const [k,v] of Object.entries(a)) if (v) counts[k] = (counts[k] ?? 0) + 1;
  }
  let winner = options[0]?.id ?? null;
  for (const id of Object.keys(counts)) if (counts[id] > (counts[winner!] ?? -1)) winner = id;
  return { approvals: counts, winner };
}

function tallyRCV(options: {id:string}[], ballots: any[]) {
  let active = new Set(options.map(o=>o.id));
  const rounds: Array<{ tallies: Record<string, number>, eliminated?: string }> = [];
  const total = ballots.length || 1;
  while (active.size > 1) {
    const t: Record<string, number> = Object.fromEntries([...active].map(id=>[id,0]));
    for (const b of ballots) {
      const r = (b.rankingJson ?? []) as string[];
      const top = r.find(id => active.has(id));
      if (top) t[top] += 1;
    }
    rounds.push({ tallies: { ...t } });
    // majority check
    const [lead, leadCount] = Object.entries(t).sort((a,b)=>b[1]-a[1])[0];
    if (leadCount > total/2) return { rcvRounds: rounds, winner: lead };
    // eliminate weakest
    const [weak] = Object.entries(t).sort((a,b)=>a[1]-b[1])[0];
    active.delete(weak);
    rounds[rounds.length-1].eliminated = weak;
  }
  const winner = [...active][0] ?? null;
  return { rcvRounds: rounds, winner };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const s = await prisma.voteSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (s.closedAt) return NextResponse.json({ error: 'Already closed' }, { status: 400 });

  const ballots = await prisma.voteBallot.findMany({ where: { sessionId: s.id } });
  const opts = (s.optionsJson as any[]) ?? [];
  const tally = s.method === 'approval'
    ? tallyApproval(opts, ballots)
    : tallyRCV(opts, ballots);

  const closed = await prisma.voteSession.update({
    where: { id: s.id },
    data: { closedAt: new Date(), tallyJson: tally, winnerId: (tally as any).winner ?? null },
  });

  // Create receipt
  await createDecisionReceipt({
    deliberationId: s.deliberationId,
    kind: 'allocative',
    subject: { type: s.subjectType as any, id: s.subjectId },
    issuedBy: { who: 'vote' },
    inputs: { method: s.method, tally, sessionId: s.id, options: opts },
  });

  (bus as any).emitEvent?.('votes:changed', { deliberationId: s.deliberationId, sessionId: s.id });
  return NextResponse.json({ ok: true, session: closed, tally });
}
