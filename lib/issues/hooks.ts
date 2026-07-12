// lib/issues/hooks.ts
import { prisma } from '@/lib/prismaclient';
import type { MoveKind } from '../dialogue/types';
import { IssueLinkTargetType } from '@prisma/client';
const LABEL_PREFIX = 'Open CQ'; // label convention

export async function onDialogueMove(opts: {
  deliberationId: string;
  targetType: 'argument'|'claim'|'card';
  targetId: string;
  kind: MoveKind;
  payload?: any;
}) {
  const { deliberationId, targetType, targetId, kind, payload } = opts;

  // 1) Resolve target argument id for linking (best-effort)
  let argumentId: string | null = null;
  if (targetType === 'argument') {
    argumentId = targetId;
  } else if (targetType === 'claim') {
    const arg = await prisma.argument.findFirst({ where: { deliberationId, claimId: targetId }, select: { id: true } });
    argumentId = arg?.id ?? null;
  } else if (targetType === 'card') {
    const card = await prisma.deliberationCard.findUnique({ where: { id: targetId }, select: { claimId: true } });
    if (card?.claimId) {
      const arg = await prisma.argument.findFirst({ where: { deliberationId, claimId: card.claimId }, select: { id: true } });
      argumentId = arg?.id ?? null;
    }
  }

  // 2) Compute a stable CQ key (matches your legal-moves/open-cqs logic)
  const cqKey = String(payload?.cqId ?? payload?.schemeKey ?? 'default');

  // 3) WHY => ensure an OPEN issue exists (linked if we found an argument)
  if (kind === 'WHY') {
    const label = `${LABEL_PREFIX}: ${cqKey}`;
    const existing = await prisma.issue.findFirst({
       where: {
        deliberationId, state: 'open', kind: 'cq', key: cqKey,
        ...(argumentId ? { links: { some: { argumentId } } } : {})
      },
      select: { id: true },
    });
    if (!existing) {
      const issue = await prisma.issue.create({
        data: {
          deliberationId,
          label,
          description: String(payload?.note ?? payload?.brief ?? '').slice(0, 500) || null,
           kind: 'cq',
           key: cqKey,
           createdById: BigInt(payload?.createdById ?? '0'),
           links: argumentId
             ? { create: [{ targetType: 'argument' as IssueLinkTargetType, targetId: argumentId, argumentId }] }
             : undefined,
        },
      });
      return { createdId: issue.id };
    }
    return { createdId: null };
  }

  // 4) GROUNDS / CONCEDE / CLOSE => close any matching OPEN issues for this cqKey
  if (kind === 'GROUNDS' || kind === 'CONCEDE' || kind === 'CLOSE') {
    const label = `${LABEL_PREFIX}: ${cqKey}`;
    const open = await prisma.issue.findMany({
      where: {
        deliberationId, state: 'open', kind: 'cq', key: cqKey,
        ...(argumentId ? { links: { some: { argumentId } } } : {})
      },
      select: { id: true },
    });
    if (open.length) {
      await prisma.issue.updateMany({ where: { id: { in: open.map(o => o.id) } }, data: { state: 'closed', closedAt: new Date() } });
      return { closed: open.length };
    }
  }

  return {};
}
