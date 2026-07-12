
import { prisma } from '@/lib/prisma-cli';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { applyToCS, interactCE } from '@/packages/ludics-engine/commitments';

const deliberationId = process.argv[2] || 'dlg_legal_demo';

async function main() {
  // 1) Insert a few DialogueMoves (toy structure)
  await prisma.dialogueMove.createMany({
    data: [
      { deliberationId, targetType: 'claim', targetId: 'C1', kind: 'ASSERT', payload: { text: 'contract' }, actorId: 'P' },
      { deliberationId, targetType: 'claim', targetId: 'C1', kind: 'GROUNDS', payload: { brief: 'signed doc' }, actorId: 'P' },
      { deliberationId, targetType: 'claim', targetId: 'C2', kind: 'ASSERT', payload: { text: 'delivered' }, actorId: 'P' },
      { deliberationId, targetType: 'claim', targetId: 'C3', kind: 'WHY',     payload: { note: 'show receipt' }, actorId: 'O' },
    ]
  }).catch(()=>null);

  // 2) Compile to designs
  await compileFromMoves(deliberationId);

  // 3) Commitments (Proponent has r1 rule; Opponent has notPaid to create clash)
  await applyToCS(deliberationId, 'Proponent', { add: [{ label:'r1', basePolarity:'neg' }] });
  await applyToCS(deliberationId, 'Proponent', { add: [{ label:'contract', basePolarity:'pos' }, { label:'delivered', basePolarity:'pos' }] });
  await applyToCS(deliberationId, 'Opponent',  { add: [{ label:'notPaid', basePolarity:'pos' }] });

  // 4) Derive (to.pay) and see contradiction
  const pInf = await interactCE(deliberationId, 'Proponent');
  const oInf = await interactCE(deliberationId, 'Opponent');

  console.log({ pDerived: pInf.derivedFacts, pContradictions: pInf.contradictions, oContradictions: oInf.contradictions });
}

main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
