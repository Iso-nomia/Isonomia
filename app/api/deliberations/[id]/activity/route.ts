export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

// Optional: if you have this util, uncomment and use it
// import { getCurrentUserId } from '@/lib/serverutils';

type ActivityItem = {
  id: string;                              // source-prefixed id (e.g., dm_<id>)
  type: 'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'
      | 'APPROVAL'
      | 'CLAIM_SUPPORTED'|'CLAIM_REBUTTED'
      | 'ISSUE_LINK'
      | 'DIALOGUE_MOVE';
  createdAt: string;                       // ISO
  actorId?: string | null;
  targetType?: 'argument'|'claim'|'card';
  targetId?: string;
  summary?: string;                        // short human string
  payload?: any;                           // raw payload for UI tooltips
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deliberationId = params.id;
    const url = new URL(req.url);
    let authorId = url.searchParams.get('authorId');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 200);

    if (!authorId || authorId === 'me') {
      try {
        // If you have an auth util, uncomment:
        // authorId = await getCurrentUserId();
      } catch {}
    }
    if (!authorId) {
      return NextResponse.json({ ok:false, error:'Unauthorized (authorId required or session missing)' }, { status:401 });
    }

    // 1) Find authored content ids
    const [myArgs, myClaims, myCards] = await Promise.all([
      prisma.argument.findMany({
        where: { deliberationId, authorId },
        select: { id: true },
      }),
      prisma.claim.findMany({
        where: { deliberationId, createdById: authorId },
        select: { id: true },
      }),
      prisma.deliberationCard.findMany({
        where: { deliberationId, authorId },
        select: { id: true },
      }),
    ]);

    const argIds = myArgs.map(a => a.id);
    const claimIds = myClaims.map(c => c.id);
    const cardIds = myCards.map(c => c.id);

    // nothing authored => empty feed
    if (!argIds.length && !claimIds.length && !cardIds.length) {
      return NextResponse.json({ ok:true, items: [] });
    }

    // 2) Gather events

    // 2a) Dialogue moves on user's content
    const dm = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        OR: [
          { targetType: 'argument', targetId: { in: argIds } },
          { targetType: 'claim',    targetId: { in: claimIds } },
          { targetType: 'card',     targetId: { in: cardIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, kind: true, payload: true, actorId: true, createdAt: true,
        targetType: true, targetId: true,
      },
    });

    const dmItems: ActivityItem[] = dm.map(m => {
      let type: ActivityItem['type'] = 'DIALOGUE_MOVE';
      if (m.kind === 'WHY')      type = 'WHY';
      else if (m.kind === 'GROUNDS') type = 'GROUNDS';
      else if (m.kind === 'RETRACT') type = 'RETRACT';
      else if (m.kind === 'ASSERT' && (m.payload as any)?.as === 'CONCEDE') type = 'CONCEDE';

      return {
        id: `dm_${m.id}`,
        type,
        createdAt: m.createdAt.toISOString(),
        actorId: m.actorId ?? null,
        targetType: m.targetType as any,
        targetId: m.targetId ?? undefined,
        summary: type === 'WHY'
          ? `WHY on ${m.targetType}`
          : type === 'GROUNDS'
          ? `Grounds on ${m.targetType}`
          : type === 'RETRACT'
          ? `Retracted ${m.targetType}`
          : type === 'CONCEDE'
          ? `Conceded on ${m.targetType}`
          : `${m.kind} on ${m.targetType}`,
        payload: m.payload,
      };
    });

    // 2b) Approvals on user's arguments
    const approvals = argIds.length ? await prisma.argumentApproval.findMany({
      where: { deliberationId, argumentId: { in: argIds } },
      orderBy: { createdAt: 'desc' },
      select: { id:true, userId:true, argumentId:true, createdAt:true }
    }) : [];

    const approvalItems: ActivityItem[] = approvals.map(a => ({
      id: `appr_${a.id}`,
      type: 'APPROVAL',
      createdAt: a.createdAt.toISOString(),
      actorId: a.userId,
      targetType: 'argument',
      targetId: a.argumentId,
      summary: 'Your argument was approved',
    }));

    // 2c) ClaimEdges on user's claims (supports/rebuts)
    const claimEdges = claimIds.length ? await prisma.claimEdge.findMany({
      where: { toClaimId: { in: claimIds } },
      orderBy: { createdAt: 'desc' },
      select: { id:true, fromClaimId:true, toClaimId:true, type:true, createdAt:true },
    }) : [];

    const ceItems: ActivityItem[] = claimEdges.map(e => ({
      id: `ce_${e.id}`,
      type: e.type === 'supports' ? 'CLAIM_SUPPORTED' : e.type === 'rebuts' ? 'CLAIM_REBUTTED' : 'DIALOGUE_MOVE',
      createdAt: e.createdAt.toISOString(),
      actorId: null,
      targetType: 'claim',
      targetId: e.toClaimId,
      summary: e.type === 'supports' ? 'Your claim received support' :
               e.type === 'rebuts'   ? 'Your claim was rebutted' :
               'Claim relation changed',
      payload: { fromClaimId: e.fromClaimId, toClaimId: e.toClaimId, type: e.type },
    }));

    // 2d) Issues linking to user's arguments
    const issueLinks = argIds.length ? await prisma.issueLink.findMany({
      where: { argumentId: { in: argIds } },
      select: {
        issueId: true,
        argumentId: true,
        issue: { select: { id:true, label:true, createdById:true, createdAt:true } },
      }
    }) : [];

    const issueItems: ActivityItem[] = issueLinks.map(l => ({
      id: `issuelink_${l.issueId}_${l.argumentId}`,
      type: 'ISSUE_LINK',
      createdAt: (l.issue?.createdAt ?? new Date()).toISOString(),
      actorId: l.issue?.createdById != null ? String(l.issue.createdById) : null,
      targetType: 'argument',
      targetId: l.argumentId ?? undefined,
      summary: `Issue linked: ${l.issue?.label ?? ''}`,
      payload: { issueId: l.issueId, label: l.issue?.label },
    }));

    // 3) Merge, sort, slice
    const merged = [...dmItems, ...approvalItems, ...ceItems, ...issueItems]
      .sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit);

    return NextResponse.json({ ok:true, items: merged });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'ACTIVITY_FAILED' }, { status:500 });
  }
}
