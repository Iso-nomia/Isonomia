// scripts/seed-aif-v05.ts
import { prisma } from '@/lib/prismaclient';
import { DeliberationHostType, TargetType } from "@prisma/client";

async function ensureUser(id: number, name: string) {
  const u = await prisma.user.upsert({
    where: { id },
    update: {},
    create: { id, name, auth_id: `seed-auth-${id}`, username: name.toLowerCase() },
  });
  return u.id;
}

async function run() {
  const proId = await ensureUser(1, 'Proponent');
  const oppId = await ensureUser(2, 'Opponent');

  const delib = await prisma.deliberation.upsert({
    where: { id: 'demo-aif-v05' },
    update: {},
    create: {
      id: 'demo-aif-v05',
      hostType: DeliberationHostType.article,
      hostId: proId.toString(),
      createdById: proId.toString()
    },
  });

  // Scheme (if not already in DB)
  const scheme = await prisma.argumentScheme.upsert({
    where: { key: 'expert_opinion' },
    update: {},
    create: {
      key: 'expert_opinion',
      name: 'Argument from Expert Opinion',
      summary: 'Arguments based on the opinion of an expert in a domain.',
      slotHints: {
        premises: [
          { role: 'expertise',   label: 'E is an expert in domain D' },
          { role: 'assertion',   label: 'E asserts that A is true' },
          { role: 'credibility', label: 'E is credible' },
        ],
      } as any,
      cqs: [
        { cqKey:'expert?',     text:'Is E an expert in D?',       attackType:'UNDERMINES', targetScope:'premise' },
        { cqKey:'says?',       text:'Did E assert A?',            attackType:'UNDERMINES', targetScope:'premise' },
        { cqKey:'credible?',   text:'Is E credible/unbiased?',    attackType:'UNDERMINES', targetScope:'premise' },
        { cqKey:'exceptions?', text:'Are there defeaters?',       attackType:'UNDERCUTS',  targetScope:'inference' },
        { cqKey:'consensus?',  text:'Do other experts disagree?', attackType:'REBUTS',     targetScope:'conclusion' },
      ] as any
    },
  });

    // Ensure a simple Expert Opinion scheme with a few CQs exists
  let scheme = await prisma.argumentScheme.findFirst({ where: { key: 'expert_opinion' } });
  if (!scheme) {
    scheme = await prisma.argumentScheme.create({
      data: {
        key: 'expert_opinion',
        name: 'Expert Opinion',
        summary: 'Expert Opinion scheme for evaluating claims based on expert testimony.',
        slotHints: { premises:[{ role:'expert', label:'Expert' }, { role:'domain', label:'Domain' }] },
        cqs: {
          create: [
            { cqKey:'EO.expertise', text:'Is the source an expert in the domain?', attackType:'UNDERCUTS', targetScope:'inference', instanceId: "", attackKind: 'UNDERCUT', status: 'open', openedById: user },
            { cqKey:'EO.bias',      text:'Is the source unbiased?',               attackType:'UNDERCUTS', targetScope:'inference', instanceId: "", attackKind: 'UNDERCUT', status: 'open', openedById: user },
            { cqKey:'EO.backing',   text:'Is the opinion grounded?',              attackType:'UNDERMINES', targetScope:'premise', instanceId: "", attackKind: 'UNDERMINE', status: 'open', openedById: user },
            { cqKey:'EO.counter',   text:'Is there a contrary expert?',           attackType:'REBUTS',     targetScope:'conclusion', instanceId: "", attackKind: 'REBUT', status: 'open', openedById: user },
          ]
        }
      }
    });
  }

  // Claims
  const c_alfsays   = await prisma.claim.create({ data: { moid: "c_alfsays", deliberationId: delib.id, createdById: proId.toString(), text: 'Alf says most Canadian philosophers go to OSSA' } });
  const c_expert    = await prisma.claim.create({ data: { moid: "c_expert", deliberationId: delib.id, createdById: proId.toString(), text: 'Alf is an expert in Canadian philosophy' } });
  const c_credible  = await prisma.claim.create({ data: { moid: "c_credible", deliberationId: delib.id, createdById: proId.toString(), text: 'Alf is credible (unbiased/reliable)' } });
  const c_concl     = await prisma.claim.create({ data: { moid: "c_concl", deliberationId: delib.id, createdById: proId.toString(), text: 'Most Canadian philosophers go to OSSA' } });

  // Argument: Expert Opinion
  const arg = await prisma.argument.create({
    data: {
      deliberationId: delib.id,
      authorId: proId.toString(),
      conclusionClaimId: c_concl.id,
      schemeId: scheme.id,
      text: 'From expert opinion (Alf)',
    }
  });
  await prisma.argumentPremise.createMany({
    data: [
      { argumentId: arg.id, claimId: c_expert.id, isImplicit: false },
      { argumentId: arg.id, claimId: c_alfsays.id, isImplicit: false },
      { argumentId: arg.id, claimId: c_credible.id, isImplicit: false },
    ],
    skipDuplicates: true,
  });

  // Open CQ statuses (for toolbar UX)
  const cqkeys = ['expert?','says?','credible?','exceptions?','consensus?'];
  await prisma.cQStatus.createMany({
    data: cqkeys.map(k => ({
      deliberationId: delib.id,
      targetType: 'argument' as TargetType,
      targetId: arg.id,
      cqKey: k,
      status: "open",
      schemeKey: scheme.key,
      createdById: proId.toString()
    })),
    skipDuplicates: true
  });

  // Ludics designs (if your Ludics panel expects them)
  await prisma.ludicDesign.createMany({
    data: [
      { deliberationId: delib.id, participantId: 'Proponent', rootLocusId: "root-proponent" },
      { deliberationId: delib.id, participantId: 'Opponent', rootLocusId: "root-opponent" },
    ],
    skipDuplicates: true
  });

  console.log('Seeded deliberation demo-aif-v05 with argument', arg.id);
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
