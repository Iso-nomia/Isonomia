import { prisma } from '@/lib/prismaclient';

// Rolls up open WHYs per DebateNode by peeking into your existing dialogueMove table
export async function unresolvedCQsForNode(sheetId: string, nodeId: string, targetType: 'claim'|'argument'|'card', targetId: string) {
  // mirrors your /open-cqs route logic, but returns a simple list
  const rows = await prisma.dialogueMove.findMany({
    where: { deliberationId: sheetId, targetType, targetId, kind: { in: ['WHY','GROUNDS'] } },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, payload: true, createdAt: true },
  });
  const latest = new Map<string, { kind:'WHY'|'GROUNDS', createdAt: Date }>();
  for (const r of rows) {
    const payload = (r.payload ?? {}) as { cqId?: unknown; schemeKey?: unknown };
    const key = String(payload.cqId ?? payload.schemeKey ?? 'default');
    const prev = latest.get(key);
    if (!prev || r.createdAt > prev.createdAt) latest.set(key, { kind: r.kind as any, createdAt: r.createdAt });
  }
  return [...latest.entries()].filter(([,v]) => v.kind === 'WHY').map(([cqKey]) => ({ nodeId, cqKey }));
}
