// scripts/seed/ludicsPatterns.ts
import { prisma } from '@/lib/prismaclient';

async function mkMove(did: string, targetId: string, kind: string, payload: any, actor='Proponent') {
  // include signature to satisfy your schema
  const signature = `${kind}:${actor}:${targetId}:${JSON.stringify(payload).slice(0,80)}`;
  await prisma.dialogueMove.create({
    data: { deliberationId: did, targetType:'claim', targetId, kind, payload, actorId: actor, signature },
  });
}

export async function seedLocusSolum(did: string, claimId: string) {
  // P ASSERT
  await mkMove(did, claimId, 'ASSERT', { text: 'X' }, 'Proponent');
  // O WHY chain (nested)
  await mkMove(did, claimId, 'WHY', { note:'Why X?' }, 'Opponent');
  await mkMove(did, claimId, 'GROUNDS', { brief:'Because A' }, 'Proponent');
  await mkMove(did, claimId, 'WHY', { note:'Why A?' }, 'Opponent');
  await mkMove(did, claimId, 'GROUNDS', { brief:'Because B' }, 'Proponent');
  // add a rebut path
  await mkMove(did, claimId, 'WHY', { note:'Counterexample C?' }, 'Opponent');
  await mkMove(did, claimId, 'GROUNDS', { brief:'C excluded by D' }, 'Proponent');
}

if (require.main === module) {
  const did = process.argv[2]!;
  const cid = process.argv[3]!;
  seedLocusSolum(did, cid).then(()=>process.exit(0));
}
