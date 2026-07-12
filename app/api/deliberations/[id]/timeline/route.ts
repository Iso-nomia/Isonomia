import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

type Event = {
  ts: string;
  kind: 'ASSERT'|'GROUNDS'|'REBUT_C'|'REBUT_P'|'UNDERCUT'|'APPROVE'|'PANEL'|'STATUS'|'SELECT_VIEWPOINTS';
  actorId?: string | null;
  ref: { type: 'argument'|'claim'|'edge'|'panel'|'status'|'selection'; id: string };
  meta?: Record<string, any>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const url = new URL(req.url);
  const since = url.searchParams.get('since') ? new Date(url.searchParams.get('since')!) : null;
  const until = url.searchParams.get('until') ? new Date(url.searchParams.get('until')!) : null;
  const kindsParam = url.searchParams.get('kinds');
  const kinds = kindsParam ? new Set(kindsParam.split(',').map(s => s.trim())) : null;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 2000);

  const range: any = {};
  if (since) range.gte = since;
  if (until) range.lte = until;

  const [args, claims, cedges, approvals, receipts, selections] = await Promise.all([
    prisma.argument.findMany({
      where: { deliberationId, ...(since || until ? { createdAt: range } : {}) },
      select: { id: true, authorId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.claim.findMany({
      where: { deliberationId, ...(since || until ? { createdAt: range } : {}) },
      select: { id: true, createdById: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.claimEdge.findMany({
      where: { deliberationId, ...(since || until ? { createdAt: range } : {}) },
      select: { id: true, createdAt: true, type: true, attackType: true, fromClaimId: true, toClaimId: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.argumentApproval.findMany({
      where: { deliberationId, ...(since || until ? { createdAt: range } : {}) },
      select: { id: true, createdAt: true, userId: true, argumentId: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.decisionReceipt.findMany({
      where: { roomId: (await prisma.deliberation.findUnique({ where: { id: deliberationId }, select: { roomId: true } }))?.roomId ?? '' ,
               ...(since || until ? { createdAt: range } : {}) },
      select: { id: true, action: true, reason: true, targetType: true, targetId: true, panelId: true, actorId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.viewpointSelection.findMany({
      where: { deliberationId, ...(since || until ? { createdAt: range } : {}) },
      select: { id: true, rule: true, k: true, jrSatisfied: true, createdById: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    }),
  ]);

  const events: Event[] = [];

  for (const a of args) {
    events.push({ ts: a.createdAt.toISOString(), kind: 'ASSERT', actorId: a.authorId, ref: { type:'argument', id: a.id } });
  }
  for (const c of claims) {
    events.push({ ts: c.createdAt.toISOString(), kind: 'ASSERT', actorId: c.createdById, ref: { type:'claim', id: c.id } });
  }
  for (const e of cedges) {
    const atk = e.attackType; // 'REBUTS'|'UNDERCUTS'|'UNDERMINES'|null
    let kind: Event['kind'] = 'GROUNDS';
    if (e.type === 'rebuts' || atk === 'REBUTS') kind = 'REBUT_C';
    if (atk === 'UNDERMINES') kind = 'REBUT_P';
    if (atk === 'UNDERCUTS')  kind = 'UNDERCUT';
    events.push({
      ts: e.createdAt.toISOString(),
      kind,
      ref: { type: 'edge', id: e.id },
      meta: { from: e.fromClaimId, to: e.toClaimId, type: e.type, attackType: e.attackType }
    });
  }
  for (const ap of approvals) {
    events.push({
      ts: ap.createdAt.toISOString(),
      kind: 'APPROVE',
      actorId: ap.userId,
      ref: { type: 'argument', id: ap.argumentId },
    });
  }
  for (const r of receipts) {
    const isPanel = r.action?.startsWith('PANEL');
    const isStatus = r.action === 'STATUS_CHANGE';
    events.push({
      ts: r.createdAt.toISOString(),
      kind: isPanel ? 'PANEL' : isStatus ? 'STATUS' : 'STATUS',
      actorId: r.actorId,
      ref: { type: isPanel ? 'panel' : 'status', id: r.id },
      meta: { action: r.action, reason: r.reason, targetType: r.targetType, targetId: r.targetId, panelId: r.panelId }
    });
  }
  for (const s of selections) {
    events.push({
      ts: s.createdAt.toISOString(),
      kind: 'SELECT_VIEWPOINTS',
      actorId: s.createdById,
      ref: { type: 'selection', id: s.id },
      meta: { rule: s.rule, k: s.k, jrSatisfied: s.jrSatisfied }
    });
  }

  events.sort((a,b)=> a.ts.localeCompare(b.ts));
  const filtered = kinds ? events.filter(e => kinds.has(e.kind)) : events;
  return NextResponse.json({ items: filtered.slice(0, limit) });
}
