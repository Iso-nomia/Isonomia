export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';

export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed outside development' }, { status: 403 });
  }

  // idempotent-ish: reuse by text match
  const [u1, u2] = await Promise.all([
    prisma.user.upsert({ where:{ auth_id:'proponent@example.test' }, update:{}, create:{ auth_id:'proponent@example.test', username:'proponent', name:'Proponent' }}),
    prisma.user.upsert({ where:{ auth_id:'opponent@example.test' }, update:{}, create:{ auth_id:'opponent@example.test', username:'opponent', name:'Opponent' }}),
  ]);

  const delib = await prisma.deliberation.create({
    data: { title: 'Seeded debate', createdById: u1.id.toString(), hostType: 'free', hostId: u1.id.toString() } as any
  });

  const [c1, c2, c3] = await prisma.$transaction([
    prisma.claim.create({ data:{ deliberationId: delib.id, text:'Carbon pricing reduces emissions', createdById: u1.id.toString(), moid: `smoke-${delib.id}-c1` }}),
    prisma.claim.create({ data:{ deliberationId: delib.id, text:'Experts in climate science support carbon pricing', createdById: u1.id.toString(), moid: `smoke-${delib.id}-c2` }}),
    prisma.claim.create({ data:{ deliberationId: delib.id, text:'Dr Smith is a credible climate expert', createdById: u1.id.toString(), moid: `smoke-${delib.id}-c3` }}),
  ]);

  const scheme = await prisma.argumentScheme.create({
    data:{
      key:'expert_opinion', name:'Argument from Expert Opinion',
      summary:'Argument from Expert Opinion',
      slotHints:{ premises:3, conclusion:1 } as any,
      cqs:{ create:[ { cqKey:'cq_expert_bias', text:'Is the expert unbiased?', attackKind:'UNDERCUTS', status:'open', attackType:'UNDERCUTS', targetScope:'inference' } ] }
    }
  });

  const arg = await prisma.argument.create({
    data:{
      deliberationId: delib.id,
      authorId: u1.id.toString(),
      conclusionClaimId: c1.id,
      schemeId: scheme.id,
      text: 'Seed: expert opinion for carbon pricing',
      implicitWarrant: { note:'Expert is credible & domain appropriate' } as any
    }
  });

  await prisma.argumentPremise.createMany({
    data:[
      { argumentId: arg.id, claimId: c2.id, isImplicit:false },
      { argumentId: arg.id, claimId: c3.id, isImplicit:false },
    ],
    skipDuplicates:true
  });

  // One WHY from opponent, one GROUNDS from proponent (CQ satisfied)
  const whySeam = await createDialogueMove({
    deliberationId: delib.id,
    kind: 'WHY',
    type: 'WHY' as any,
    illocution: 'Question' as any,
    actorId: u2.id.toString(),
    authorId: u2.id.toString(),
    targetType: 'argument',
    targetId: arg.id,
    signature: ['WHY','argument',arg.id,'cq_expert_bias'].join(':'),
    payload: { cqId: 'cq_expert_bias', locusPath: '0' },
    locusPath: '0',
  });
  const why = whySeam.move;

  await prisma.cQStatus.create({ data:{ targetType:'argument', targetId: arg.id, argumentId: arg.id, schemeKey:'expert_opinion', cqKey:'cq_expert_bias', status:'open', createdById: u1.id.toString() } }).catch(()=>null);

  await createDialogueMove({
    deliberationId: delib.id,
    kind: 'GROUNDS',
    type: 'GROUNDS' as any,
    illocution: 'Argue' as any,
    actorId: u1.id.toString(),
    authorId: u1.id.toString(),
    targetType: 'argument',
    targetId: arg.id,
    replyToMoveId: why.id,
    signature: ['GROUNDS','argument',arg.id,'cq_expert_bias',Date.now()].join(':'),
    payload: { cqId: 'cq_expert_bias', locusPath: '0', acts:[{ polarity:'pos', locusPath:'0', openings:[], expression:'Expert shows no conflict of interest', additive:false }] },
    locusPath: '0',
  });

  return NextResponse.json({ ok:true, deliberationId: delib.id, argumentId: arg.id, claimIds:[c1.id,c2.id,c3.id] }, { headers:{ 'Cache-Control':'no-store' }});
}
