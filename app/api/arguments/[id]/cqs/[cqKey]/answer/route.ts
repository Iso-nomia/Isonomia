export const dynamic = "force-dynamic";

// // app/api/arguments/[id]/cqs/[cqKey]/answer/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { TargetType, EdgeType, AttackType } from '@prisma/client';
import { Edge } from '@xyflow/react';
import { ensureArgumentSupportInTx } from '@/lib/arguments/ensure-support';

export async function POST(req: Request, { params }: { params:{ id:string; cqKey:string } }) {
  const body = await req.json().catch(()=> ({}));
  const { authorId, deliberationId, replyToMoveId, attackerArgument, targetPremiseId } = body ?? {};

  const arg = await prisma.argument.findUnique({
    where:{ id: params.id },
    include:{ scheme:{ include:{ cqs:true } }, premises:true, conclusion:true }
  });
  if (!arg?.scheme) return NextResponse.json({ ok:false, error:'Argument or scheme not found' }, { status:404 });

  const cq = arg.scheme.cqs.find(q => q.cqKey === params.cqKey);
  if (!cq) return NextResponse.json({ ok:false, error:'CQ not found' }, { status:404 });

  const result = await prisma.$transaction(async (tx) => {
    // CQStatus: manual upsert (no reliance on composite unique type names)
    const prev = await tx.cQStatus.findFirst({ where: { argumentId: arg.id, cqKey: cq.cqKey ?? "" } });
    if (prev) await tx.cQStatus.update({ where: { id: prev.id }, data: { status:'answered' } });
    else      await tx.cQStatus.create({
      data: {
        argumentId: arg.id,
        cqKey: cq.cqKey ?? "",
        status: "answered",
        targetType: "argument" as TargetType,
        targetId: arg.id,
        schemeKey: arg.scheme?.id ?? "",
        createdById: authorId ?? ""
      }
    });

    // WHY → GROUNDS anchoring (locutions)
    const grounds = (authorId && deliberationId)
      ? await tx.dialogueMove.create({
          data: {
            deliberationId, authorId, type:'GROUNDS', illocution:'Argue' as any,
            replyToMoveId: replyToMoveId ?? null, argumentId: null,
            kind:'GROUNDS', actorId: authorId, targetType:'argument', targetId: arg.id,
            signature: ['GROUNDS','argument',arg.id, cq.cqKey, Date.now()].join(':'),
            payload: { cqId: cq.cqKey }
          } as any
        })
      : null;

    // Optional: instantiate a defeating RA from attackerArgument and wire CA typed by the CQ
    let attacker:any = null, edge:any = null;
    if (attackerArgument) {
      attacker = await tx.argument.create({
        data: {
          deliberationId, authorId,
          conclusionClaimId: attackerArgument.conclusionClaimId,
          schemeId: attackerArgument.schemeId ?? null,
          implicitWarrant: attackerArgument.implicitWarrant ?? null,
          text: attackerArgument.text ?? ''
        }
      });
      
      // PHASE 1: Ensure ArgumentSupport record exists
      if (attacker.conclusionClaimId) {
        await ensureArgumentSupportInTx(tx, {
          argumentId: attacker.id,
          claimId: attacker.conclusionClaimId,
          deliberationId,
        }).catch((err: any) => {
          console.error('[cq/answer] Failed to ensure ArgumentSupport:', err.message);
        });
      }
      
      await tx.argumentPremise.createMany({
        data: (attackerArgument.premiseClaimIds ?? []).map((cid:string)=>({ argumentId: attacker.id, claimId: cid, isImplicit:false })),
        skipDuplicates:true
      });

      // Map CQ → (attackType, targetScope) and attach
      edge = await tx.argumentEdge.create({
        data: {
          deliberationId,
          fromArgumentId: attacker.id,
          toArgumentId: arg.id,
          attackType: cq.attackType,
          targetScope: cq.targetScope ?? undefined,
          targetClaimId: cq.attackType === "REBUTS" ? arg.conclusionClaimId : null,
          targetPremiseId: cq.attackType === "UNDERMINES"
            ? (targetPremiseId ?? arg.premises[0]?.claimId ?? null)
            : null,
          cqKey: cq.cqKey,
          createdById: authorId,
          type: (cq.attackType === 'UNDERCUTS' ? 'undercut' : 'rebut') as EdgeType
        }
      });
      if (grounds) await tx.dialogueMove.update({ where:{ id: grounds.id }, data:{ argumentId: attacker.id }});
    }

    return { grounds, attacker, edge };
  });

  return NextResponse.json({ ok:true, ...result }, { status:201, headers:{'Cache-Control':'no-store'} });
}

