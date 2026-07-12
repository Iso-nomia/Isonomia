export const dynamic = "force-dynamic";

// app/api/aif/conflicts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { z } from 'zod';

const Body = z.object({
  deliberationId: z.string().min(6),
  createdById: z.string().min(1),
  schemeKey: z.string().nullable().optional(), // e.g., 'REBUT','UNDERCUT','UNDERMINE','ExpertUnreliability'
  conflicting: z.object({
    kind: z.enum(['CLAIM','RA']),
    id: z.string().min(6),
  }),
  conflicted: z.object({
    kind: z.enum(['CLAIM','RA']),
    id: z.string().min(6),
  }),
  // optional for CQ provenance
  cqKey: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const p = Body.parse(await req.json().catch(()=> ({})));

  // Guard: AIF Def 2.1 — S-nodes must have pred+succ; CA has exactly one conflicting/conflicted.
  // (We ensure that by construction.)

  const scheme = p.schemeKey
    ? await prisma.conflictScheme.upsert({
        where: { key: p.schemeKey },
        update: {},
        create: { key: p.schemeKey, name: p.schemeKey },
        select: { id: true }
      })
    : null;

  const ca = await prisma.conflictApplication.create({
    data: {
      deliberationId: p.deliberationId,
      schemeId: scheme?.id ?? null,
      createdById: p.createdById,
      metaJson: { cqKey: p.cqKey ?? null, note: p.note ?? null },
      conflictingClaimId:   p.conflicting.kind === 'CLAIM' ? p.conflicting.id : null,
      conflictingArgumentId:p.conflicting.kind === 'RA'    ? p.conflicting.id : null,
      conflictedClaimId:   p.conflicted.kind === 'CLAIM' ? p.conflicted.id : null,
      conflictedArgumentId:p.conflicted.kind === 'RA'    ? p.conflicted.id : null,
    },
    select: { id: true, schemeId: true }
  });

  // ✨ PHASE 1: Create ATTACK DialogueMove for dialogue provenance
  let attackMoveId: string | null = null;
  try {
    const targetType = p.conflicted.kind === 'RA' ? 'argument' : 'claim';
    const targetId = p.conflicted.id;
    
    const attackLabels: Record<string, string> = {
      'REBUT': 'I challenge this conclusion',
      'UNDERCUT': 'I challenge the reasoning',
      'UNDERMINE': 'I challenge this premise',
    };
    const expression = attackLabels[p.schemeKey?.toUpperCase() || ''] || 'I challenge this';
    
    const seamResult = await createDialogueMove({
      deliberationId: p.deliberationId,
      targetType: targetType as any,
      targetId,
      kind: 'ATTACK',
      actorId: p.createdById,
      payload: {
        schemeKey: p.schemeKey,
        cqKey: p.cqKey,
        locusPath: '0',
        expression,
        conflictApplicationId: ca.id,
      },
      signature: `ATTACK:${targetType}:${targetId}:aif_${ca.id}`,
      endsWithDaimon: false,
      locusPath: '0',
    });
    const attackMove = seamResult.move;
    attackMoveId = attackMove.id;
    
    console.log('[aif/conflicts] Created ATTACK move:', {
      attackMoveId: attackMove.id,
      conflictApplicationId: ca.id,
    });
  } catch (err) {
    console.error('[aif/conflicts] Failed to create ATTACK move:', err);
  }

  // Update ConflictApplication with dialogue provenance link
  if (attackMoveId) {
    await prisma.conflictApplication.update({
      where: { id: ca.id },
      data: { createdByMoveId: attackMoveId },
    }).catch((err) => {
      console.error('[aif/conflicts] Failed to link CA to ATTACK move:', err);
    });
  }

  // Materialize a legacy view row so your AF stays lit:
  // Map CA to argumentEdge when a RA is the target (undercuts), or when an I is the target (rebuts).
  // You can refine this mapping as needed.
  try {
    const targetArgId =
      p.conflicted.kind === 'RA' ? p.conflicted.id :
      p.conflicting.kind === 'RA' ? p.conflicting.id : null;

    if (targetArgId) {
      await prisma.argumentEdge.create({
        data: {
          deliberationId: p.deliberationId,
          createdById: p.createdById,
          fromArgumentId: p.conflicting.kind === 'RA' ? p.conflicting.id : targetArgId, // heuristic
          toArgumentId: targetArgId,
          type: (p.schemeKey === 'UNDERCUT' ? 'undercut' : 'rebut') as any,
          attackType: (p.schemeKey ?? 'REBUT').toUpperCase() as any,
          targetScope: p.schemeKey === 'UNDERCUT' ? 'inference' : 'conclusion',
          cqKey: p.cqKey ?? null,
        }
      }).catch(()=>{});
    }
  } catch {}

  return NextResponse.json({ ok: true, id: ca.id }, { headers: { 'Cache-Control': 'no-store' } });
}
