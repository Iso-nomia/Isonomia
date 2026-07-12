// lib/dialogue/validate.ts
import { prisma } from '@/lib/prismaclient';
import type { MoveKind } from './types';
import type { RCode } from './codes';
//  type ReasonCode =
//   | 'R1_TURN_VIOLATION'        // optional: alternation/focus rules
//   | 'R2_NO_OPEN_CQ'         // e.g., GROUNDS w/o an open WHY for this cq key
//   | 'R3_SELF_REPLY'            // replying to your own move when not allowed
//   | 'R4_DUPLICATE_REPLY'       // same reply to same target/key
//   | 'R5_AFTER_SURRENDER'       // attacking a surrendered/closed branch
//   | 'R6_INVALID_INITIAL'       // illegal first move in a thread
//   | 'R7_ACCEPT_ARGUMENT_REQUIRED'; // concession where protocol requires accepting the argument




export async function validateMove(input: {
  deliberationId: string; actorId: string;
  kind: MoveKind
  targetType: 'argument'|'claim'|'card'; targetId: string;
  replyToMoveId?: string | null; replyTarget?: string | null;
  payload: any;
}): Promise<{ ok:true } | { ok:false; reasons: RCode[] }> {
  const reasons: RCode[] = [];
  const { deliberationId, actorId, kind, targetType, targetId, replyToMoveId, payload } = input;
  const locusPath = String(payload?.locusPath ?? '0');
  const cqKey = String(payload?.cqId ?? payload?.schemeKey ?? 'default');

  // R3: self-reply block (only when precise ancestry known)
  if (replyToMoveId) {
       const parent = await prisma.dialogueMove.findUnique({
      where: { id: replyToMoveId },
      select: { actorId: true, kind: true, /* guard against alt shape */ type: true }
    });
    if (parent && String(parent.actorId) === String(actorId)) reasons.push('R3_SELF_REPLY');
    const parentKind = String((parent as any)?.kind ?? (parent as any)?.type ?? '').toUpperCase();
    if ((kind === 'CONCEDE' || input.payload?.as === 'CONCEDE') && parentKind === 'GROUNDS') {
      reasons.push('R7_ACCEPT_ARGUMENT_REQUIRED');
    }
  }
  // Optional fallback: if conceding a claim and any WHY on it has been answered by GROUNDS,
  // require "Accept argument" even without a threaded reply.
  if (reasons.length === 0 && kind === 'CONCEDE' && targetType === 'claim' && !replyToMoveId) {
    const wg = await prisma.dialogueMove.findMany({
      where: { deliberationId, targetType, targetId, kind: { in: ['WHY','GROUNDS'] } },
      orderBy: { createdAt: 'asc' },
      select: { kind: true, payload: true, createdAt: true }
    });
    const latest = new Map<string, 'WHY'|'GROUNDS'>();
    for (const r of wg) {
      const key = String((r as any).payload?.cqId ?? (r as any).payload?.schemeKey ?? 'default');
      latest.set(key, r.kind as 'WHY'|'GROUNDS');
    }
    const anyGrounds = [...latest.values()].some(k => k === 'GROUNDS');
    if (anyGrounds) reasons.push('R7_ACCEPT_ARGUMENT_REQUIRED');
  }
  // R2: GROUNDS must answer an open WHY with the same key
  if (kind === 'GROUNDS') {
    const last = await prisma.dialogueMove.findMany({
      where: { deliberationId, targetType, targetId, kind: { in: ['WHY','GROUNDS'] } },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { kind:true, payload:true, createdAt:true }
    });
    const latestOnKey = last.find(r => {
      const payload = r.payload;
      if (typeof payload === "object" && payload !== null) {
        return String((payload as any).cqId ?? (payload as any).schemeKey ?? "default") === cqKey;
      }
      return "default" === cqKey;
    });
    if (!latestOnKey || latestOnKey.kind !== 'WHY') reasons.push('R2_NO_OPEN_CQ');
  }

  // R5: no ATTACK after surrender/close at this locus
  // EXCEPTION: CQ-based WHY/GROUNDS moves (clarifying questions and answers) are allowed even after surrender
  // This allows continued inquiry via Critical Questions on surrendered claims
  const isCQMove = (kind === 'WHY' || kind === 'GROUNDS') && (payload?.cqId || payload?.schemeKey);
  
  if (!isCQMove && (kind === 'WHY' || kind === 'GROUNDS' || (kind === 'ASSERT' && !payload?.as))) {
    const lastTerminator = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId, targetType, targetId,
        OR: [
          { kind:'CLOSE', payload: { path:['locusPath'], equals: locusPath } },
          { kind:'ASSERT', payload: { path:['as'], equals: 'CONCEDE' } },
        ],
      }, orderBy: { createdAt: 'desc' }, select: { id:true }
    });
    if (lastTerminator) reasons.push('R5_AFTER_SURRENDER');
  }

  // R4: duplicate reply (idempotency guard)
  if (['WHY','GROUNDS','CLOSE'].includes(kind)) {
    const baseSig =
      kind === 'WHY'     ? `WHY:${targetType}:${targetId}:${cqKey}` :
      kind === 'GROUNDS' ? `GROUNDS:${targetType}:${targetId}:${cqKey}` :
                           `CLOSE:${targetType}:${targetId}:${locusPath}`;
    const existing = await prisma.dialogueMove.findFirst({
      where: { deliberationId, signature: { startsWith: baseSig } },
      select: { id:true }
    });
    if (existing) reasons.push('R4_DUPLICATE_REPLY');
  }

  // R8: DISCHARGE requires open SUPPOSE at same locus
  if (kind === 'DISCHARGE') {
    // Find the most recent SUPPOSE at this locus
    const openSuppose = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId,
        targetType,
        targetId,
        kind: 'SUPPOSE',
        payload: { path: ['locusPath'], equals: locusPath }
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true }
    });

    if (!openSuppose) {
      // No SUPPOSE at this locus
      reasons.push('R8_NO_OPEN_SUPPOSE');
    } else {
      // Check if this SUPPOSE was already discharged
      const matchingDischarge = await prisma.dialogueMove.findFirst({
        where: {
          deliberationId,
          targetType,
          targetId,
          kind: 'DISCHARGE',
          payload: { path: ['locusPath'], equals: locusPath },
          createdAt: { gt: openSuppose.createdAt }
        },
        select: { id: true }
      });

      if (matchingDischarge) {
        // SUPPOSE was already discharged
        reasons.push('R8_NO_OPEN_SUPPOSE');
      }
    }
  }

  return reasons.length ? { ok:false, reasons } : { ok:true };
}