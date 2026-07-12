// scripts/backfill_commitments.ts
// Usage:
//   npx ts-node --transpile-only scripts/backfill_commitments.ts --dry-run
//   npx ts-node --transpile-only scripts/backfill_commitments.ts
//
// Requires: Commitment model + unique([deliberationId, participantId, proposition])
// See PR-2 schema. Assumes DialogueMove(kind, payload, targetType, targetId, actorId, deliberationId)

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type DM = {
  id: string;
  deliberationId: string;
  targetType: 'argument'|'claim'|'card';
  targetId: string;
  kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'|'CLOSE';
  payload: any | null;
  actorId: string | null;
  createdAt: Date;
};

function isConcede(move: DM) {
  return move.kind === 'CONCEDE' || (move.kind === 'ASSERT' && move.payload?.as === 'CONCEDE');
}

async function resolvePropositionFor(move: DM): Promise<string | null> {
  if (move.targetType === 'claim') {
    const c = await prisma.claim.findUnique({ where: { id: move.targetId }, select: { text: true } });
    if (c?.text) return c.text.trim();
  } else if (move.targetType === 'argument') {
    const a = await prisma.argument.findUnique({ where: { id: move.targetId }, select: { text: true } });
    if (a?.text) return a.text.trim();
  }
  const expr = String(move.payload?.expression ?? move.payload?.brief ?? move.payload?.note ?? '').trim();
  return expr || null;
}

async function backfill(dryRun: boolean) {
  // 1) All “concede” shapes (old & normalized)
  const concedes: DM[] = await prisma.dialogueMove.findMany({
    where: {
      OR: [
        { kind: 'CONCEDE' },
        { kind: 'ASSERT', payload: { path: ['as'], equals: 'CONCEDE' } as any },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2) RETRACTs
  const retracts: DM[] = await prisma.dialogueMove.findMany({
    where: { kind: 'RETRACT' },
    orderBy: { createdAt: 'asc' },
  });

  let upserts = 0, retractsDone = 0;

  for (const m of concedes) {
    const prop = await resolvePropositionFor(m);
    if (!prop || !m.actorId) continue;
    if (!dryRun) {
      await prisma.commitment.upsert({
        where: {
          deliberationId_participantId_proposition: {
            deliberationId: m.deliberationId,
            participantId: m.actorId,
            proposition: prop,
          },
        },
        update: { isRetracted: false },
        create: {
          deliberationId: m.deliberationId,
          participantId: m.actorId,
          proposition: prop,
          isRetracted: false,
        },
      }).catch(() => {});
    }
    upserts++;
  }

  for (const m of retracts) {
    const prop = await resolvePropositionFor(m);
    if (!prop || !m.actorId) continue;
    if (!dryRun) {
      await prisma.commitment.updateMany({
        where: {
          deliberationId: m.deliberationId,
          participantId: m.actorId,
          proposition: prop,
          isRetracted: false,
        },
        data: { isRetracted: true },
      }).catch(() => {});
    }
    retractsDone++;
  }

  console.log(`Commitments upserted: ${upserts}; Commitments retracted: ${retractsDone}; dryRun=${dryRun}`);
}

(async () => {
  const dry = process.argv.includes('--dry-run');
  await backfill(dry);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
