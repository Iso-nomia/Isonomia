// scripts/seed-metrovale.ts
//
// Usage:
//   npx ts-node -P tsconfig.scripts.json -r tsconfig-paths/register scripts/seed-metrovale.ts <DELIB_OR_DIALOGUE_ID>
//
// What it seeds:
//   • Deliberation (if not passed)
//   • Root locus "0", P/O designs
//   • A few opening acts on both sides (Metrovale CBD pricing toy case)
//   • Commitment sets for P and O
//   • compileFromMoves + one neutral step to warm caches
//   • Prints status + quick CE results

import 'dotenv/config';
import { prisma } from '@/lib/prisma-cli';
import { appendActs } from '@/packages/ludics-engine/appendActs';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import { applyToCS, interactCE } from '@/packages/ludics-engine/commitments';

type Delib = Awaited<ReturnType<typeof prisma.deliberation.findUnique>>;
type Design = Awaited<ReturnType<typeof prisma.ludicDesign.findUnique>>;
type Locus  = Awaited<ReturnType<typeof prisma.ludicLocus.findUnique>>;

async function ensureDeliberation(idArg?: string): Promise<NonNullable<Delib>> {
  if (idArg) {
    const found = await prisma.deliberation.findUnique({ where: { id: idArg } });
    if (!found) throw new Error(`Deliberation ${idArg} not found`);
    return found;
  }
  const hostId = 'metrovale-cbd-pricing';
  let d = await prisma.deliberation.findFirst({ where: { hostType: 'post', hostId } });
  if (!d) {
    d = await prisma.deliberation.create({
      data: {
        hostType: 'post',
        hostId,
        createdById: 'seed',
        rule: 'utilitarian',
        k: 3,
      },
    });
  }
  return d;
}

async function ensureRoot(dialogueId: string): Promise<NonNullable<Locus>> {
  // composite unique (dialogueId, path)
  const root = await prisma.ludicLocus.upsert({
    where: { dialogueId_path: { dialogueId, path: '0' } },
    update: {},
    create: { dialogueId, path: '0' },
  });
  return root;
}

async function ensureDesigns(dialogueId: string, rootId: string): Promise<{ P: NonNullable<Design>; O: NonNullable<Design> }> {
  const existing = await prisma.ludicDesign.findMany({ where: { deliberationId: dialogueId } });
  let P = existing.find(d => d.participantId === 'Proponent') ?? null;
  let O = existing.find(d => d.participantId === 'Opponent') ?? null;

  if (!P) {
    P = await prisma.ludicDesign.create({
      data: { deliberationId: dialogueId, participantId: 'Proponent', rootLocusId: rootId },
    });
  }
  if (!O) {
    O = await prisma.ludicDesign.create({
      data: { deliberationId: dialogueId, participantId: 'Opponent', rootLocusId: rootId },
    });
  }
  return { P, O };
}

async function seedActs(Pid: string, Oid: string): Promise<void> {
  // Proponent facts at 0.1, 0.2, 0.3 (+ ACK by Opponent at 0.3.1)
  await appendActs(
    Pid,
    [
      { kind: 'PROPER', locusPath: '0.1', ramification: [], expression: 'congestion_high' },
      { kind: 'PROPER', locusPath: '0.2', ramification: [], expression: 'revenue_earmarked_transit' },
      { kind: 'PROPER', locusPath: '0.3', ramification: ['1'], expression: 'equity_program_in_place' },
    ],
    { enforceAlternation: false, enforceAdditiveOnce: false }
  );

  await appendActs(
    Oid,
    [{ kind: 'PROPER', locusPath: '0.3.1', ramification: [], expression: 'ACK' }],
    { enforceAlternation: false, enforceAdditiveOnce: false }
  );

  await appendActs(Oid, [
  { kind:'PROPER', locusPath:'0.1', ramification:[], expression:'challenge_0_1' },
], { enforceAlternation:false, enforceAdditiveOnce:false });

  // Opponent facts at 0.4, 0.5
  await appendActs(
    Oid,
    [
      { kind: 'PROPER', locusPath: '0.4', ramification: [], expression: 'small_business_margin_thin' },
      { kind: 'PROPER', locusPath: '0.5', ramification: [], expression: 'charge_on_access' },
    ],
    { enforceAlternation: false, enforceAdditiveOnce: false }
  );
}

async function seedCommitments(dialogueId: string): Promise<void> {
  // Proponent facts & rules
  await applyToCS(dialogueId, 'Proponent', {
    add: [
      { label: 'congestion_high',           basePolarity: 'pos', baseLocusPath: '0.1' },
      { label: 'revenue_earmarked_transit', basePolarity: 'pos', baseLocusPath: '0.2' },
      { label: 'equity_program_in_place',   basePolarity: 'pos', baseLocusPath: '0.3' },
      { label: 'congestion_high & revenue_earmarked_transit -> net_public_benefit', basePolarity: 'neg', baseLocusPath: '0' },
      { label: 'equity_program_in_place -> not regressive_impact',                  basePolarity: 'neg', baseLocusPath: '0' },
      { label: 'net_public_benefit -> policy_justified',                            basePolarity: 'neg', baseLocusPath: '0' },
    ],
  });

  // Opponent facts & rules
  await applyToCS(dialogueId, 'Opponent', {
    add: [
      { label: 'small_business_margin_thin', basePolarity: 'pos', baseLocusPath: '0.4' },
      { label: 'charge_on_access',           basePolarity: 'pos', baseLocusPath: '0.5' },
      // NOTE: they conceded equity_program_in_place at 0.3.1, so no "not equity_program_in_place" here
      { label: 'charge_on_access & not equity_program_in_place -> regressive_impact', basePolarity: 'neg', baseLocusPath: '0' },
      { label: 'regressive_impact -> not net_public_benefit',                          basePolarity: 'neg', baseLocusPath: '0' },
    ],
  });
}

async function main(): Promise<void> {
  const idArg = process.argv[2]; // deliberation/dialogue id (we alias them 1:1)
  const d = await ensureDeliberation(idArg);
  const dialogueId = d.id;

  const root = await ensureRoot(dialogueId);
  const { P, O } = await ensureDesigns(dialogueId, root.id);

  await seedActs(P.id, O.id);
  await seedCommitments(dialogueId);

  // compile designs from any pending moves/acts, ignore if already compiled
//   await compileFromMoves(dialogueId).catch(() => {});

  const designs = await prisma.ludicDesign.findMany({ where: { deliberationId: dialogueId } });
  const pos = designs.find(x => x.participantId === 'Proponent');
  const neg = designs.find(x => x.participantId === 'Opponent');
  if (!pos || !neg) throw new Error('Missing Proponent/Opponent designs after compile');

  const trace = await stepInteraction({
    dialogueId,
    posDesignId: pos.id,
    negDesignId: neg.id,
    phase: 'neutral',
    maxPairs: 1024,
  });

  const P_res = await interactCE(dialogueId, 'Proponent');
  const O_res = await interactCE(dialogueId, 'Opponent');

  console.log('Deliberation:', dialogueId);
  console.log('Trace:', trace.status, (trace.pairs ?? []).length, 'pairs');
  console.log('P derived:', P_res.derivedFacts);
  console.log('P contradictions:', P_res.contradictions);
  console.log('O derived:', O_res.derivedFacts);
  console.log('O contradictions:', O_res.contradictions);
  console.log('Open the page → Deep Dive → Ludics tab; Unified tree + Commitments are seeded.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
