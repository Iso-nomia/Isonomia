// scripts/seed-ludics.ts
import 'dotenv/config';
import { prisma } from '@/lib/prismaclient';
import { getOrCreateDeliberationId } from '@/lib/deepdive/upsert';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import fetch from 'node-fetch';

// VE toys
import { VE, vePlus, veTensor, fingerprintVE } from '@/packages/ludics-core/ve';

async function main() {
  // 1) Deliberation
  const roomId = 'seed-room';
  const hostId = 'seed-host';
  const createdById = 'seed-user';
  const deliberationId = await getOrCreateDeliberationId('room_thread', hostId, roomId, createdById);
  console.log('Deliberation:', deliberationId); // uses your helper  [lib/deepdive/upsert.ts]
  //                                                                         :contentReference[oaicite:10]{index=10}

  // 2) Insert two arguments (targets)
  const A = await prisma.argument.create({
    data: {
      deliberationId, authorId: createdById,
      text: 'If congestion fees rise, peak-hour traffic will drop.',
    },
    select: { id: true }
  });
  const B = await prisma.argument.create({
    data: {
      deliberationId, authorId: createdById,
      text: 'Surge pricing harms low-income commuters.',
    },
    select: { id: true }
  });
  console.log('Arguments:', A.id, B.id);

  // 3) Post WHY on A, then GROUNDS answer & commit (owner: Proponent)
  // /api/dialogue/move payload/acts/† mapping per your route  [move route]
  //                                                              :contentReference[oaicite:11]{index=11}
  const why = await fetch('http://localhost:3000/api/dialogue/move', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deliberationId,
      targetType: 'argument',
      targetId: A.id,
      kind: 'WHY',
      payload: { cqId: 'evidence', expression: 'What is the empirical basis?' },
      autoCompile: true,
      autoStep: true
    })
  }).then(r => r.json());
  console.log('WHY:', why.ok, why.move?.id);

  // answer & commit with the helper endpoint
  const grounds = await fetch('http://localhost:3000/api/dialogue/answer-and-commit', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deliberationId,
      targetType: 'argument',
      targetId: A.id,
      cqKey: 'evidence',
      locusPath: '0',
      expression: 'RCT: Stockholm 2006 trial reduced peak flow ~20%',
      original: 'Stockholm trial data showed ~20% peak reduction',
      commitOwner: 'Proponent',
      commitPolarity: 'pos'
    })
  }).then(r => r.json());
  console.log('GROUNDS+Commit:', grounds.ok, grounds.move?.id);
  // The above endpoint writes GROUNDS with a signature & applies to CS.  [answer-and-commit]
  //                                                                             :contentReference[oaicite:12]{index=12}

  // 4) Compile designs & step the interaction explicitly to get trace/† hints
  await compileFromMoves(deliberationId).catch(() => {});
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId }, orderBy: [{ participantId: 'asc' }, { id: 'asc' }],
    select: { id: true, participantId: true }
  });
  const pos = designs.find(d => d.participantId === 'Proponent') ?? designs[0];
  const neg = designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0];
  const step = (pos && neg)
    ? await stepInteraction({ dialogueId: deliberationId, posDesignId: pos.id, negDesignId: neg.id, phase: 'neutral', maxPairs: 256 })
    : null;
  console.log('Step trace:', !!step);

  // 5) If locus is closable, post CLOSE (†).  [legal-moves provides daimon hints]
  //                                            :contentReference[oaicite:13]{index=13}
  const lm = await fetch(`http://localhost:3000/api/dialogue/legal-moves?` + new URLSearchParams({
    deliberationId, targetType: 'argument', targetId: A.id, locusPath: '0'
  })).then(r => r.json());
  const closeMove = (lm.moves || []).find((m: any) => m.kind === 'CLOSE');
  if (closeMove) {
    const r = await fetch('http://localhost:3000/api/dialogue/move', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deliberationId, targetType: 'argument', targetId: A.id, kind: 'CLOSE',
        payload: { locusPath: '0' }, autoCompile: false, autoStep: true
      })
    }).then(r => r.json());
    console.log('CLOSE(†):', r.ok);
  } else {
    console.log('† not yet legal at locus 0; continuing…');
  }

  // 6) Tiny MALL smoke test on VE: ⊕ and ⊗ fingerprints (canonical snapshots)
  const tiny: VE = {
    base: 'ξ',
    paths: [
      [{ pol: 'pos', locus: 'ξ', key: 'a' }],
      [{ pol: 'pos', locus: 'ξ', key: 'b' }, { pol: 'neg', locus: 'ξ', key: 'k' }, { pol: 'daimon', locus: 'ξ' }],
    ]
  };
  const tiny2: VE = {
    base: 'ξ',
    paths: [
      [{ pol: 'pos', locus: 'ξ', key: 'c' }],
    ]
  };
  const plus = vePlus(tiny, tiny2);
  const tens = veTensor(tiny, tiny2);
  console.log('⊕ fingerprint:', fingerprintVE(plus));
  console.log('⊗ fingerprint:', fingerprintVE(tens));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
