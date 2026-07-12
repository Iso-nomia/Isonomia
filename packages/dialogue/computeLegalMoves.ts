// packages/dialogue/computeLegalMoves.ts
import { prisma } from '@/lib/prismaclient';

export type LegalMove = {
  kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE',
  label: string,
  payload?: any,
  disabled?: boolean,
  reason?: string,
};

export async function computeLegalMoves(opts: {
  deliberationId: string, targetType: 'argument'|'claim'|'card', targetId: string
}): Promise<LegalMove[]> {
  const { deliberationId, targetType, targetId } = opts;

  // Open CQs (same logic as /open-cqs)
  const rows = await prisma.dialogueMove.findMany({
    where: { deliberationId, targetId, kind: { in: ['WHY','GROUNDS'] } },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, payload: true, createdAt: true },
  });

  type Row = { kind: 'WHY'|'GROUNDS'; payload: any; createdAt: Date };
  const latestByKey = new Map<string, Row>();
  for (const r of rows as Row[]) {
    const key = String(r?.payload?.cqId ?? r?.payload?.schemeKey ?? 'default');
    const prev = latestByKey.get(key);
    if (!prev || r.createdAt > prev.createdAt) latestByKey.set(key, r);
  }
  const openKeys = [...latestByKey.entries()].filter(([,v]) => v.kind === 'WHY').map(([k]) => k);

  const moves: LegalMove[] = [];

  // Answer each open CQ (GROUNDS)
  for (const k of openKeys) {
    moves.push({
      kind: 'GROUNDS',
      label: `Answer CQ: ${k}`,
      payload: { cqId: k }, // schemeKey is allowed too; server will include it in signature
    });
  }

  // If no open WHYs, allow asking WHY (user can pick scheme in composer)
  if (openKeys.length === 0) {
    moves.push({ kind: 'WHY', label: 'Ask WHY (challenge)' });
  }

  // Always allow Concede/Retraction (composer clarifies)
  moves.push({ kind: 'CONCEDE', label: 'Concede' });
  moves.push({ kind: 'RETRACT', label: 'Retract' });

  return moves;
}
