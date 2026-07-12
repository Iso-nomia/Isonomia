export const dynamic = "force-dynamic";

// app/api/cq/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { computeAspicConflictMetadata } from '@/lib/aspic/conflictHelpers';
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: NextRequest) {
  const b = await req.json().catch(()=> ({}));
  const { action, deliberationId, argumentId, schemeKey, cqKey, authorId, resolution, attachCA } = b ?? {};
  if (!deliberationId || !argumentId || !schemeKey || !cqKey) {
    return NextResponse.json({ ok:false, error:'Missing deliberationId|argumentId|schemeKey|cqKey' }, { status:400, ...NO_STORE });
  }

  if (action === 'open') {
    await prisma.cQStatus.upsert({
      where: { targetType_targetId_schemeKey_cqKey: { targetType: 'argument', targetId: argumentId, schemeKey, cqKey } },
      create: { targetType: 'argument', targetId: argumentId, argumentId, status:'open', schemeKey, cqKey, satisfied:false, createdById: String(authorId||'self') },
      update: { status:'open', satisfied:false },
    });
    return NextResponse.json({ ok:true }, NO_STORE);
  }

  if (action === 'resolve' || action === 'close') {
    await prisma.cQStatus.updateMany({
      where: { targetType: 'argument', targetId: argumentId, schemeKey, cqKey },
      data: { status: resolution === 'answered' ? 'answered' : 'closed', satisfied: resolution === 'answered' },
    }).catch(()=>{});

    // Optional: create a CA edge that embodies the answer/objection (if provided)
    if (attachCA?.attackType) {
      // ✨ PHASE 1: Create ATTACK DialogueMove first
      let attackMoveId: string | null = null;
      try {
        const targetType = attachCA.conflictedArgumentId ? 'argument' : 'claim';
        const targetId = attachCA.conflictedArgumentId ?? attachCA.conflictedClaimId;
        
        if (targetId) {
          const attackLabels: Record<string, string> = {
            'REBUTS': 'I challenge this conclusion',
            'UNDERCUTS': 'I challenge the reasoning',
            'UNDERMINES': 'I challenge this premise',
          };
          const expression = attackLabels[attachCA.attackType] || 'I challenge this';
          
          const seamResult = await createDialogueMove({
            deliberationId,
            targetType: targetType as any,
            targetId,
            kind: 'ATTACK',
            actorId: String(authorId || 'self'),
            payload: {
              cqKey,
              schemeKey,
              locusPath: '0',
              expression,
              attackType: attachCA.attackType,
            },
            signature: `ATTACK:${targetType}:${targetId}:cq_${cqKey}`,
            endsWithDaimon: false,
            locusPath: '0',
          });
          const attackMove = seamResult.move;
          attackMoveId = attackMove.id;
          
          console.log('[cq] Created ATTACK move for CQ resolution:', {
            attackMoveId: attackMove.id,
            cqKey,
            targetId,
          });
        }
      } catch (err) {
        console.error('[cq] Failed to create ATTACK move:', err);
      }
      
      // Compute ASPIC+ metadata for ConflictApplication
      const aspicMetadata = computeAspicConflictMetadata(
        null, // No ASPIC+ computation in this legacy endpoint
        {
          attackType: attachCA.attackType,
          targetScope: attachCA.targetScope,
          cqKey,
          schemeKey,
        },
        attachCA.conflictingClaimId,
        attachCA.conflictedArgumentId || attachCA.conflictedClaimId
      );
      
      await (prisma as any).conflictApplication.create({
        data: {
          deliberationId,
          createdById: String(authorId || 'self'),
          legacyAttackType: attachCA.attackType,
          legacyTargetScope: attachCA.targetScope,
          conflictedArgumentId: attachCA.conflictedArgumentId ?? null,
          conflictingClaimId: attachCA.conflictingClaimId ?? null,
          conflictedClaimId: attachCA.conflictedClaimId ?? null,
          // Link to ATTACK move for dialogue provenance
          createdByMoveId: attackMoveId,
          // ASPIC+ Integration - Phase 1d
          aspicAttackType: aspicMetadata.aspicAttackType,
          aspicDefeatStatus: aspicMetadata.aspicDefeatStatus,
          aspicMetadata: aspicMetadata.aspicMetadata,
        }
      }).catch(()=>{});
    }
    return NextResponse.json({ ok:true }, NO_STORE);
  }

  return NextResponse.json({ ok:false, error:'Unsupported action' }, { status:400, ...NO_STORE });
}
