import { prisma } from '@/lib/prisma-cli';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { applyToCS, interactCE } from '@/packages/ludics-engine/commitments';

const deliberationId = process.argv[2] || 'dlg_legal_demo';

function ok(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ ${msg}`);
  }
  return cond;
}

async function main() {
  // Ensure parent deliberation exists
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

  // Seed a few DialogueMoves (idempotent-ish)
  await prisma.dialogueMove.createMany({
    data: [
      { deliberationId, targetType: 'claim', targetId: 'C1', kind: 'ASSERT',  payload: { text: 'contract' }, actorId: 'P' },
      { deliberationId, targetType: 'claim', targetId: 'C1', kind: 'GROUNDS', payload: { brief: 'signed doc' }, actorId: 'P' },
      { deliberationId, targetType: 'claim', targetId: 'C2', kind: 'ASSERT',  payload: { text: 'delivered' }, actorId: 'P' },
      { deliberationId, targetType: 'claim', targetId: 'C3', kind: 'WHY',     payload: { note: 'show receipt' }, actorId: 'O' },
    ],
    skipDuplicates: true,
  }).catch(()=>null);

  // Compile to designs (does safe cascade clear first)
  await compileFromMoves(deliberationId);

  // Commitments:
  // Proponent: rule r1 + facts contract, delivered → derive to.pay
  await applyToCS(deliberationId, 'Proponent', { add: [{ label:'r1', basePolarity:'neg' }] });
  await applyToCS(deliberationId, 'Proponent', { add: [
    { label:'contract',  basePolarity:'pos' },
    { label:'delivered', basePolarity:'pos' },
  ] });

  // Opponent: notPaid (to demonstrate no *cross-owner* contradiction)
  await applyToCS(deliberationId, 'Opponent', { add: [{ label:'notPaid', basePolarity:'pos' }] });

  // Reason
  const p = await interactCE(deliberationId, 'Proponent');
  const o = await interactCE(deliberationId, 'Opponent');

  // Assertions
  const gotToPay = p.derivedFacts.some(d => d.label === 'to.pay');
  const noPContradictions = (p.contradictions ?? []).length === 0;
  const noOContradictions = (o.contradictions ?? []).length === 0;

  const a1 = ok(gotToPay,            `Proponent derives "to.pay" from {r1, contract, delivered}`);
  const a2 = ok(noPContradictions,   `Proponent CS has no internal contradiction`);
  const a3 = ok(noOContradictions,   `Opponent CS has no internal contradiction`);

  const all = a1 && a2 && a3;

  // Summary + exit
  if (!all) {
    console.error('\nVerification failed. See ❌ above.');
    process.exit(1);
  } else {
    console.log('\nAll checks passed.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});