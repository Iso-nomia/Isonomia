/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed an end-to-end Theory Builder → Knowledge Graph → Ludics pipeline.
 *
 * USAGE:
 *   npx ts-node -P tsconfig.scripts.json -r tsconfig-paths/register scripts/seed-theory-ludics-pipeline.ts <DELIBERATION_ID>
 *
 * WHAT IT CREATES:
 *   • 4 Works (IH, TC, DN, OP) + their theses-slot records (WorkIHTheses, WorkTCTheses, WorkDNStructure, WorkOPTheses)
 *   • Practical (MCDA) for IH & TC; Pascal model for OP
 *   • KnowledgeEdge: SUPPLIES_PREMISE (DN → IH/TC), ALTERNATIVE_TO (IH↔TC), EVALUATES (IH → TC using IH snapshot)
 *   • Ludics: loci under '0', designs for Proponent/Opponent, a few acts so LociTree renders branches
 */
async function main() {
  const deliberationId = process.argv[2];
  if (!deliberationId) {
    console.error('Usage: ts-node scripts/seed-theory-ludics-pipeline.ts <DELIBERATION_ID>');
    process.exit(1);
  }
     // Scope Ludic loci so '0', '0.1', ... don't clash across dialogues.
   // For now we use one dialogue per deliberation:
   const dialogueId = deliberationId;

  console.log('Seeding for deliberation:', deliberationId);

  // --- Convenient owner/author for all Works
  const SEED_AUTHOR = 'seed-user';

  // --- Create Works ------------------------------------------------------
  const ihWork = await prisma.theoryWork.create({
    data: {
      deliberationId,
      authorId: SEED_AUTHOR,
      title: 'IH — Fair Triage Practice',
      body: 'Interpret current triage practice and propose an ideal standard output.',
      theoryType: 'IH',
      standardOutput: 'Maximize health outcomes while preserving autonomy',
    },
  });

  const tcWork = await prisma.theoryWork.create({
    data: {
      deliberationId,
      authorId: SEED_AUTHOR,
      title: 'TC — Triage Instrument v1',
      body: 'Design an instrument to realize fair triage under resource constraints.',
      theoryType: 'TC',
      standardOutput: 'Fair triage selection under constraints',
    },
  });

  const dnWork = await prisma.theoryWork.create({
    data: {
      deliberationId,
      authorId: SEED_AUTHOR,
      title: 'DN — Hospital Admission Patterns',
      body: 'Describe regularities in admissions; serve as empirical premises for IH/TC.',
      theoryType: 'DN',
    },
  });

  const opWork = await prisma.theoryWork.create({
    data: {
      deliberationId,
      authorId: SEED_AUTHOR,
      title: 'OP — As-if Continuity of Records',
      body: 'Assume records continuity for rational orientation; justify via Pascal decision.',
      theoryType: 'OP',
    },
  });

  // --- Theses slots ------------------------------------------------------
  await prisma.workIHTheses.upsert({
    where: { workId: ihWork.id },
    create: {
      workId: ihWork.id,
      structure: 'Queue-based triage interacting with ICU capacity.',
      function: 'Balance utility and rights across patient groups.',
      objectivity: 'Use cross-source corroboration: guidelines + stakeholders.',
    },
    update: {
      structure: 'Queue-based triage interacting with ICU capacity.',
      function: 'Balance utility and rights across patient groups.',
      objectivity: 'Use cross-source corroboration: guidelines + stakeholders.',
    },
  });

  await prisma.workTCTheses.upsert({
    where: { workId: tcWork.id },
    create: {
      workId: tcWork.id,
      instrumentFunction: 'Score patients with two criteria: outcome gain & equity.',
      explanation: 'Normalize scores per criterion; aggregate by weights.',
      applications: ['ICU admission', 'Ventilator allocation'],
    },
    update: {
      instrumentFunction: 'Score patients with two criteria: outcome gain & equity.',
      explanation: 'Normalize scores per criterion; aggregate by weights.',
      applications: ['ICU admission', 'Ventilator allocation'],
    },
  });

  await prisma.workDNStructure.upsert({
    where: { workId: dnWork.id },
    create: {
      workId: dnWork.id,
      explanandum: 'Admission spikes correlate with weekday + weather.',
      nomological: 'P(Admission | High-Load) > P(Admission | Low-Load); c.p. seasonal.',
      ceterisParibus: 'Assume constant reporting policy.',
    },
    update: {
      explanandum: 'Admission spikes correlate with weekday + weather.',
      nomological: 'P(Admission | High-Load) > P(Admission | Low-Load); c.p. seasonal.',
      ceterisParibus: 'Assume constant reporting policy.',
    },
  });

  await prisma.workOPTheses.upsert({
    where: { workId: opWork.id },
    create: {
      workId: opWork.id,
      unrecognizability: 'No theoretical evidence can settle if logs are 100% complete.',
      alternatives: ['complete', 'incomplete'],
    },
    update: {
      unrecognizability: 'No theoretical evidence can settle if logs are 100% complete.',
      alternatives: ['complete', 'incomplete'],
    },
  });

  // --- Practical MCDA for IH & TC ---------------------------------------
  const mcdaIH = {
    bestOptionId: 'optA',
    totals: { optA: 0.82, optB: 0.74, optC: 0.63 },
    weightsNormalized: { c1: 0.6, c2: 0.4 },
    perCriterionScale: { c1: { min: 0.1, max: 0.9 }, c2: { min: 0.2, max: 0.8 } },
  };
  await prisma.workPracticalJustification.upsert({
    where: { workId: ihWork.id },
    create: {
      workId: ihWork.id,
      purpose: 'Fair triage',
      criteria: [{ id: 'c1', label: 'Outcome Gain', weight: 0.6 }, { id: 'c2', label: 'Equity', weight: 0.4 }],
      options: [{ id: 'optA', label: 'A' }, { id: 'optB', label: 'B' }, { id: 'optC', label: 'C' }],
      scores: { optA: { c1: 0.8, c2: 0.7 }, optB: { c1: 0.75, c2: 0.6 }, optC: { c1: 0.65, c2: 0.55 } },
      result: mcdaIH as any,
    },
    update: {
      purpose: 'Fair triage',
      criteria: [{ id: 'c1', label: 'Outcome Gain', weight: 0.6 }, { id: 'c2', label: 'Equity', weight: 0.4 }],
      options: [{ id: 'optA', label: 'A' }, { id: 'optB', label: 'B' }, { id: 'optC', label: 'C' }],
      scores: { optA: { c1: 0.8, c2: 0.7 }, optB: { c1: 0.75, c2: 0.6 }, optC: { c1: 0.65, c2: 0.55 } },
      result: mcdaIH as any,
    },
  });

  const mcdaTC = {
    bestOptionId: 'tool1',
    totals: { tool1: 0.78, tool2: 0.72 },
    weightsNormalized: { c1: 0.5, c2: 0.5 },
    perCriterionScale: { c1: { min: 0, max: 1 }, c2: { min: 0, max: 1 } },
  };
  await prisma.workPracticalJustification.upsert({
    where: { workId: tcWork.id },
    create: {
      workId: tcWork.id,
      purpose: 'Fair triage (instrument)',
      criteria: [{ id: 'c1', label: 'Accuracy', weight: 0.5 }, { id: 'c2', label: 'Simplicity', weight: 0.5 }],
      options: [{ id: 'tool1', label: 'Tool 1' }, { id: 'tool2', label: 'Tool 2' }],
      scores: { tool1: { c1: 0.8, c2: 0.75 }, tool2: { c1: 0.75, c2: 0.69 } },
      result: mcdaTC as any,
    },
    update: {
      purpose: 'Fair triage (instrument)',
      criteria: [{ id: 'c1', label: 'Accuracy', weight: 0.5 }, { id: 'c2', label: 'Simplicity', weight: 0.5 }],
      options: [{ id: 'tool1', label: 'Tool 1' }, { id: 'tool2', label: 'Tool 2' }],
      scores: { tool1: { c1: 0.8, c2: 0.75 }, tool2: { c1: 0.75, c2: 0.69 } },
      result: mcdaTC as any,
    },
  });

  // --- Pascal model for OP -----------------------------------------------
  await prisma.workPascalModel.upsert({
    where: { workId: opWork.id },
    create: {
      workId: opWork.id,
      propositions: [{ id: 'w1', statement: 'Records complete' }, { id: 'w2', statement: 'Records incomplete' }],
      actions: [{ id: 'act1', label: 'Trust logs' }, { id: 'act2', label: 'Cross-check' }],
      utilities: {
        act1: { w1: 1.0, w2: 0.3 },
        act2: { w1: 0.8, w2: 0.7 },
      },
      assumption: 'No decisive theoretical evidence (TOP2)',
      decision: { method: 'laplace', bestActionId: 'act2', expectedByAction: { act1: 0.65, act2: 0.75 } },
    },
    update: {
      propositions: [{ id: 'w1', statement: 'Records complete' }, { id: 'w2', statement: 'Records incomplete' }],
      actions: [{ id: 'act1', label: 'Trust logs' }, { id: 'act2', label: 'Cross-check' }],
      utilities: {
        act1: { w1: 1.0, w2: 0.3 },
        act2: { w1: 0.8, w2: 0.7 },
      },
      assumption: 'No decisive theoretical evidence (TOP2)',
      decision: { method: 'laplace', bestActionId: 'act2', expectedByAction: { act1: 0.65, act2: 0.75 } },
    },
  });

  // --- Knowledge edges: DN supplies → IH/TC; IH ↔ TC alternatives; IH evaluates TC ----
  const edges: any[] = [];
  edges.push(await prisma.knowledgeEdge.create({
    data: { deliberationId, kind: 'SUPPLIES_PREMISE', fromWorkId: dnWork.id, toWorkId: ihWork.id, meta: { note: 'admissions regularities' } },
  }));
  edges.push(await prisma.knowledgeEdge.create({
    data: { deliberationId, kind: 'SUPPLIES_PREMISE', fromWorkId: dnWork.id, toWorkId: tcWork.id, meta: { note: 'baseline data' } },
  }));
  edges.push(await prisma.knowledgeEdge.create({
    data: { deliberationId, kind: 'ALTERNATIVE_TO', fromWorkId: ihWork.id, toWorkId: tcWork.id },
  }));
  edges.push(await prisma.knowledgeEdge.create({
    data: { deliberationId, kind: 'EVALUATES', fromWorkId: ihWork.id, toWorkId: tcWork.id, meta: { mcda: mcdaIH, verdict: 'IH dominates on equity' } },
  }));

  // --- Ludics: loci, designs, acts (minimal tree that shows clearly) -----
    const root = await prisma.ludicLocus.upsert({
       where: { dialogueId_path: { dialogueId, path: '0' } },
        update: {},
        create: { dialogueId, path: '0' },
      });
  const child01 = await prisma.ludicLocus.upsert({
    where: { dialogueId_path: { dialogueId, path: '0.1' } },
    update: {},
    create: { dialogueId, path: '0.1', parentId: root.id },
  });
  const child02 = await prisma.ludicLocus.upsert({
    where: { dialogueId_path: { dialogueId, path: '0.2' } },
    update: {},
    create: { dialogueId, path: '0.2', parentId: root.id },
  });

  const P = await prisma.ludicDesign.create({
    data: { deliberationId, participantId: 'Proponent', rootLocusId: root.id },
  });
  const O = await prisma.ludicDesign.create({
    data: { deliberationId, participantId: 'Opponent', rootLocusId: root.id },
  });

  // Acts (P)
  await prisma.ludicAct.createMany({
    data: [
      { designId: P.id, kind:'PROPER', polarity:'P', locusId: root.id, ramification:['1','2'], isAdditive:true, expression:'thesis', orderInDesign: 1 },
      { designId: P.id, kind:'PROPER', polarity:'P', locusId: child01.id, ramification:[], isAdditive:false, expression:'branch-1', orderInDesign: 2 },
      { designId: P.id, kind:'PROPER', polarity:'P', locusId: child02.id, ramification:[], isAdditive:false, expression:'branch-2', orderInDesign: 3 },
    ],
  });

  // Acts (O)
  await prisma.ludicAct.createMany({
    data: [
      { designId: O.id, kind:'PROPER', polarity:'O', locusId: root.id,    ramification:[], expression:'why root', orderInDesign: 1 },
      { designId: O.id, kind:'PROPER', polarity:'O', locusId: child01.id, ramification:[], expression:'why b1',   orderInDesign: 2 },
      { designId: O.id, kind:'PROPER', polarity:'O', locusId: child02.id, ramification:[], expression:'why b2',   orderInDesign: 3 },
    ],
  });

  // Chronicles (keep in sync with orderInDesign so ribbon can show indices)
  for (const d of [P, O]) {
    const acts = await prisma.ludicAct.findMany({ where: { designId: d.id }, orderBy: { orderInDesign: 'asc' } });
    await prisma.ludicChronicle.createMany({ data: acts.map(a => ({ designId: d.id, order: a.orderInDesign, actId: a.id })) });
  }

  // Result summary
  console.log('Works:');
  console.log('  IH:', ihWork.id);
  console.log('  TC:', tcWork.id);
  console.log('  DN:', dnWork.id);
  console.log('  OP:', opWork.id);
  console.log('Knowledge edges:', edges.length);
  console.log('Ludics designs:', { P: P.id, O: O.id });
  console.log('\nOpen Deep Dive at: /deepdive/' + deliberationId);
  console.log('• Works tab → should list IH/TC/DN/OP; Integrity badge will begin to fill as you edit slots.');
  console.log('• IH/TC Works → Practical Summary has “Compare vs …” to create EVALUATES.');
  console.log('• Supply Drawer → Alternatives/Evaluations show edges and MCDA snapshot.');
  console.log('• Ludics tab → LociTree should show root 0 with children 0.1 and 0.2, with P opener (additive) and O whys.');
}

main().then(() => {
  console.log('Theory↔Ludics seed complete.');
  return prisma.$disconnect();
}).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
