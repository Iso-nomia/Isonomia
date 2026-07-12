/* ts-node scripts/seed-aif.ts --delib <DELIB_ID_OR_SLUG> --user <USER_ID> */
import { prisma } from '@/lib/prismaclient';
import { TargetType } from '@prisma/client';
function arg(name:string) {
  const i = process.argv.indexOf(name);
  return i> -1 ? (process.argv[i+1] || '') : '';
}

async function main() {
  const delib = arg('--delib') || process.env.SEED_DELIBERATION_ID;
  const user  = arg('--user')  || process.env.SEED_USER_ID || 'seed-user';
  if (!delib) throw new Error('Pass --delib <id-or-slug> or SEED_DELIBERATION_ID');

  const deliberation = await prisma.deliberation.findFirst({
    where: {  id: delib  }, select: { id:true, title:true }
  });
  if (!deliberation) throw new Error(`Deliberation not found: ${delib}`);
  const deliberationId = deliberation.id;

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
  const C  = await prisma.claim.create({ data:{ deliberationId, text:'Policy X will reduce emissions', createdById:user, moid: `${deliberationId}-policy-x-claim` } });
  const P1 = await prisma.claim.create({ data:{ deliberationId, text:'Dr. Smith is an expert on climate policy', createdById:user, moid: `${deliberationId}-dr-smith-expert-claim` } });
  const P2 = await prisma.claim.create({ data:{ deliberationId, text:'Dr. Smith asserts Policy X reduces emissions', createdById:user, moid: `${deliberationId}-dr-smith-asserts-claim` } });

  // RA: {P1,P2} ⇒ C
  const A1 = await prisma.argument.create({
    data: { deliberationId, authorId:user, conclusionClaimId: C.id, schemeId: scheme.id, implicitWarrant: { licensedBy:'expertise' }, text:'' }
  });
  await prisma.argumentPremise.createMany({
    data: [{ argumentId:A1.id, claimId:P1.id }, { argumentId:A1.id, claimId:P2.id }].map(x => ({...x, isImplicit:false })), skipDuplicates:true
  });

  // Open a license CQ (bias)
  const biasKey = 'EO.bias';
  const prev = await prisma.cQStatus.findFirst({ where:{ argumentId:A1.id, cqKey:biasKey } });
  if (prev) await prisma.cQStatus.update({ where:{ id: prev.id }, data:{ status:'open' } });
  else      await prisma.cQStatus.create({
    data: {
      argumentId: A1.id,
      cqKey: biasKey,
      status: "open",
      targetType: "argument" as TargetType,
      targetId: A1.id,
      schemeKey: scheme.key,
      createdById: user
    }
  });

  // An attacker RA + CA (optional)
  const E1 = await prisma.claim.create({ data:{ deliberationId, text:'Dr. Smith has a financial conflict on Policy X', createdById:user, moid: `${deliberationId}-dr-smith-conflict-claim` } });
  const A2 = await prisma.argument.create({
    data: { deliberationId, authorId:user, conclusionClaimId:E1.id, text:'', implicitWarrant: undefined }
  });
  await prisma.argumentEdge.create({
    data: {
      deliberationId,
      fromArgumentId: A2.id,
      toArgumentId: A1.id,
      attackType: "UNDERCUTS",
      targetScope: "inference",
      targetClaimId: null,
      targetPremiseId: null,
      cqKey: biasKey,
      createdById: user,
      type: "undercut" // Use correct EdgeType value
    }
  });

  // Dialogue moves to light toolbar
  await prisma.dialogueMove.createMany({
    data: [
      { deliberationId, authorId:user, type:'ASSERT', illocution:'Assert', kind:'ASSERT', actorId:user, targetType:'claim', targetId:C.id, signature:`ASSERT:claim:${C.id}` },
      { deliberationId, authorId:user, type:'WHY',    illocution:'Question', kind:'WHY', actorId:user, targetType:'argument', targetId:A1.id, signature:`WHY:argument:${A1.id}:${biasKey}`, payload:{ cqId:biasKey } }
    ] as any[]
  });

  console.log(`Seeded AIF demo in deliberation ${deliberationId}`);
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
