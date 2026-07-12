
import { prisma } from '@/lib/prisma-cli';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { appendActs } from '@/packages/ludics-engine/appendActs';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

const deliberationId = process.argv[2] || 'dlg_contract_demo';
const ACTOR_P = 'proponent-bot';
const ACTOR_O = 'opponent-bot';

async function main() {
  // ensure parent deliberation (optional, if your DB enforces)
  await prisma.deliberation.upsert({
    where: { id: deliberationId },
    update: {},
    create: {
      id: deliberationId,
      hostType: 'article',
      hostId: 'seed',
      createdById: 'system',
    },
  });

  // Clear moves for a repeatable run
  await prisma.dialogueMove.deleteMany({ where: { deliberationId } }).catch(()=>{});

  // 1) Proponent asserts an additive offer: choose book OR surprise
  await prisma.dialogueMove.createMany({
    data: [
      { deliberationId, targetType: 'claim', targetId: 'Offer', kind: 'ASSERT',  payload: { text:'Offer', additive: true }, actorId: ACTOR_P },
      { deliberationId, targetType: 'claim', targetId: 'Offer', kind: 'GROUNDS', payload: { brief:'book' },              actorId: ACTOR_P }, // 0.1.1
      { deliberationId, targetType: 'claim', targetId: 'Offer', kind: 'GROUNDS', payload: { brief:'surprise' },          actorId: ACTOR_P }, // 0.1.2
    ],
    skipDuplicates: true,
  });

  // 2) Compile → get designs
  const { designs } = await compileFromMoves(deliberationId);
  const designsRows = await prisma.ludicDesign.findMany({
    where: { id: { in: designs } }, select: { id:true, participantId:true }
  });
  const P = designsRows.find(d => d.participantId === 'Proponent')!;
  const O = designsRows.find(d => d.participantId === 'Opponent')!;

  // 3) Under "surprise" (0.1.2), Opponent has a nested additive choice: CD or DVD
  await appendActs(O.id, [
    { kind:'PROPER', polarity:'O', locus:'0.1.2',   ramification:[], expression:'choose CD or DVD', additive:true, meta:{ justifiedByLocus:'0.1.2' } },
    { kind:'PROPER', polarity:'O', locus:'0.1.2.1', ramification:[], expression:'CD',               meta:{ justifiedByLocus:'0.1.2' } },
    { kind:'PROPER', polarity:'O', locus:'0.1.2.2', ramification:[], expression:'DVD',              meta:{ justifiedByLocus:'0.1.2' } },
  ], { enforceAlternation:false }, prisma);

  // 4) Step once to populate a baseline trace (neutral)
  const step = await stepInteraction({ dialogueId: deliberationId, posDesignId: P.id, negDesignId: O.id, phase:'neutral', maxPairs: 2048 });
  console.log('[contract-seed] step:', { status: step.status, pairs: step.pairs.length });
  console.log('Designs:', { Proponent: P.id, Opponent: O.id });
}

main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
