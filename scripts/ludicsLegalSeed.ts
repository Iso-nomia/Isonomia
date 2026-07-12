// scripts/ludicsLegalSeed.ts
import { prisma } from '../lib/prismaclient';
import { Prisma } from '@prisma/client';

import { appendActs } from '../packages/ludics-engine/appendActs';
import { applyToCS } from '../packages/ludics-engine/commitments';
import { stepInteraction } from '../packages/ludics-engine/stepper';
declare const process: any;


export interface ProperAct {
    kind: 'PROPER';
    polarity: 'P' | 'O';
    locus: string;
    ramification: string[];
    expression?: string;
    additive?: boolean;
    meta?: Prisma.InputJsonValue; // instead of Record<string, unknown>
  }
async function main() {
  // ✅ Upsert root locus
  const root = await prisma.ludicLocus.upsert({
    where: { id: 'root-0' }, // needs unique field, so use id not path
    update: {},
    create: { id: 'root-0', path: '0' },
  });

  // ✅ Create two designs
  const A = await prisma.ludicDesign.create({
    data: {
      deliberationId: 'dlg1',
      participantId: 'Plaintiff',
      rootLocusId: root.id,
    },
  });

  const B = await prisma.ludicDesign.create({
    data: {
      deliberationId: 'dlg1',
      participantId: 'Defendant',
      rootLocusId: root.id,
    },
  });

  // ✅ Commitment states
  await applyToCS('Plaintiff', {
    add: [
      { label: 'contract', basePolarity: 'pos', baseLocus: 'F.contract', designIds: [] },
      { label: 'delivered', basePolarity: 'pos', baseLocus: 'F.delivered', designIds: [] },
      { label: 'r1', basePolarity: 'pos', baseLocus: 'R.r1', designIds: [] },
    ],
  });

  await applyToCS('Defendant', {
    add: [
      { label: 'notPaid', basePolarity: 'pos', baseLocus: 'F.notPaid', designIds: [] },
    ],
  });

  // ✅ Dialogue acts
  await appendActs(A.id, [
    { kind: 'PROPER', polarity: 'P', locus: '0', ramification: ['1'], expression: 'to.pay' },
  ]);

  await appendActs(B.id, [
    { kind: 'PROPER', polarity: 'O', locus: '0', ramification: [], expression: 'WHY?' },
  ]);

  await appendActs(A.id, [{ kind: 'DAIMON' }]);

  await appendActs(B.id, [{ kind: 'DAIMON' }]);
const done = await stepInteraction({ dialogueId:'dlg1', posDesignId: A.id, negDesignId: B.id });
console.log(done); // -> { status: 'CONVERGENT', pairs: [...] }

  // ✅ Step the interaction
  const trace = await stepInteraction({
    dialogueId: 'dlg1',
    posDesignId: A.id,
    negDesignId: B.id,
  });

  console.log('Trace status:', trace.status, 'pairs:', trace.pairs?.length ?? 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
