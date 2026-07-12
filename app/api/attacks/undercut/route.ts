// app/api/attacks/undercut/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';
import { ensureArgumentSupport } from '@/lib/arguments/ensure-support';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Body = z.object({
  deliberationId: z.string().min(6).optional(),
  toArgumentId: z.string().min(6).optional(),
  toDiagramId: z.string().min(6).optional(),     // NEW: accept diagram as a fallback
  targetInferenceId: z.string().min(6),
  fromArgumentId: z.string().min(6).optional(),
  fromText: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {   targetInferenceId, fromArgumentId } = parsed.data;
  const fromText = (parsed.data.fromText && parsed.data.fromText.trim().length >= 3)
    ? parsed.data.fromText.trim()
    : 'Undercut: challenging the inference';

  // const { targetInferenceId, fromArgumentId } = parsed.data;
  // const deliberationId = parsed.data.deliberationId ?? targetArg.deliberationId;
  // const toArgumentId = targetArg.id;
  // const fromText = (parsed.data.fromText && parsed.data.fromText.trim().length >= 3)
  //   ? parsed.data.fromText.trim()
  //   : 'Undercut: challenging the inference';

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create or use existing attacking argument
  // let fromId = fromArgumentId ?? null;
  // if (!fromId) {
  //   if (!fromText) {
  //     return NextResponse.json(
  //       { ok: false, error: 'Either fromArgumentId or fromText is required' },
  //       { status: 400 }
  //     );
  //   }
    
  //   const newArg = await prisma.argument.create({
  //     data: {
  //       deliberationId,
  //       text: fromText,
  //       authorId: String(userId),
  //     },
  //     select: { id: true }
  //   });
  //   fromId = newArg.id;
  // }
     // Resolve target argument:
  let targetArg = parsed.data.toArgumentId
    ? await prisma.argument.findUnique({
        where: { id: parsed.data.toArgumentId },
        select: { id: true, deliberationId: true },
      })
    : null;

  // fallback via explicit toDiagramId
  if (!targetArg && parsed.data.toDiagramId) {
    const dn = await prisma.debateNode.findFirst({
      where: { diagramId: parsed.data.toDiagramId, argumentId: { not: null } },
      select: { argumentId: true },
    });
    if (dn?.argumentId) {
      targetArg = await prisma.argument.findUnique({
        where: { id: dn.argumentId },
        select: { id: true, deliberationId: true },
      });
    }
  }

  // fallback via inference → diagram → debateNode
  if (!targetArg) {
    const inf = await prisma.inference.findUnique({
      where: { id: parsed.data.targetInferenceId },
      select: { diagramId: true },
    });
    if (inf?.diagramId) {
      const dn = await prisma.debateNode.findFirst({
        where: { diagramId: inf.diagramId, argumentId: { not: null } },
        select: { argumentId: true },
      });
      if (dn?.argumentId) {
        targetArg = await prisma.argument.findUnique({
          where: { id: dn.argumentId },
          select: { id: true, deliberationId: true },
        });
      }
    }
  }

  if (!targetArg) {
    return NextResponse.json({ ok: false, error: 'Target argument not found' }, { status: 404 });
  }
  const toArgumentId = targetArg.id;
const deliberationId = parsed.data.deliberationId ?? (targetArg ? targetArg.deliberationId : undefined);

 let fromId = fromArgumentId ?? null;
 if (!fromId) {
   // allow a simple default if client forgot to send fromText
   const safeText = fromText && fromText.trim().length >= 3
     ? fromText.trim()
     : 'Undercut: challenging the inference';

   if (!deliberationId) {
     return NextResponse.json(
       { ok: false, error: "Missing deliberationId for argument creation" },
       { status: 400 }
     );
   }

   const newArg = await prisma.argument.create({
     data: {
       deliberationId,
       text: safeText,
       authorId: String(userId),
     },
     select: { id: true, claimId: true }
   });
   fromId = newArg.id;
   
   // PHASE 1: Ensure ArgumentSupport record exists
   // Note: Middleware should handle this, but explicit call ensures transaction safety
   if (newArg.claimId) {
     await ensureArgumentSupport({
       argumentId: newArg.id,
       claimId: newArg.claimId,
       deliberationId,
     }).catch(err => {
       console.error('[undercut] Failed to ensure ArgumentSupport:', err.message);
     });
   }
}

  // Verify the target argument exists
  // Verify target argument exists; if not, try to recover via inference->diagram->debateNode


  if (!targetArg) {
    // Recover: use the inference to find its diagram, then the DebateNode that links diagram→argument
    const inf = await prisma.inference.findUnique({
      where: { id: targetInferenceId },
      select: { id: true, diagramId: true },
    });

   if (!inf?.diagramId) {
      return NextResponse.json(
        { ok: false, error: 'Target argument not found (no inference/diagram mapping)' },
        { status: 404 }
      );
    }

    const dn = await prisma.debateNode.findFirst({
      where: { diagramId: inf.diagramId, argumentId: { not: null } },
      select: { argumentId: true },
    });

    if (dn?.argumentId) {
      targetArg = await prisma.argument.findUnique({
        where: { id: dn.argumentId },
        select: { id: true, deliberationId: true },
      });
    }

    if (!targetArg) {
      return NextResponse.json(
        { ok: false, error: 'Target argument not found (resolved from diagram failed)' },
        { status: 404 }
      );
    }
  }
  if (targetArg.deliberationId !== deliberationId) {
    return NextResponse.json(
      { ok: false, error: 'Argument does not belong to this deliberation' },
      { status: 400 }
    );
  }

  // Create the ArgumentEdge
  const edge = await prisma.argumentEdge.create({
    data: {
      deliberationId,
      fromArgumentId: fromId!,
      toArgumentId,
      type: 'undercut',
      attackType: 'UNDERCUTS',
      targetScope: 'inference',
      targetInferenceId,
      createdById: String(userId),
    },
    select: { id: true }
  });

  // ✨ PHASE 1: Create ATTACK DialogueMove for dialogue provenance
  // This links the undercut to the dialogue system
  let attackMoveId: string | null = null;
  try {
    const seamResult = await createDialogueMove({
      deliberationId,
      targetType: 'argument',
      targetId: toArgumentId,
      kind: 'ATTACK',
      actorId: String(userId),
      payload: {
        attackType: 'UNDERCUTS',
        targetScope: 'inference',
        targetInferenceId,
        locusPath: '0',
        expression: fromText,
      },
      signature: `ATTACK:argument:${toArgumentId}:undercut_${targetInferenceId}`,
      endsWithDaimon: false,
      locusPath: '0',
    });
    const attackMove = seamResult.move;
    attackMoveId = attackMove.id;
    
    console.log('[attacks/undercut] Created ATTACK move:', {
      attackMoveId: attackMove.id,
      fromArgumentId: fromId,
      toArgumentId,
    });
  } catch (err) {
    console.error('[attacks/undercut] Failed to create ATTACK move:', err);
    // Don't fail the whole request
  }

  // IMPORTANT: Also create a ConflictApplication for AIF compatibility
  // This ensures the undercut appears in the AIF graph
  const conflictApp = await prisma.conflictApplication.create({
    data: {
      deliberationId,
      conflictingArgumentId: fromId!,
      conflictedArgumentId: toArgumentId,
      legacyAttackType: 'UNDERCUTS',
      legacyTargetScope: 'inference',
      createdById: String(userId),
      // Link to ATTACK move for dialogue provenance
      createdByMoveId: attackMoveId,
    },
    select: { id: true }
  });

  // Recompute grounded semantics
  try {
    await recomputeGroundedForDelib(deliberationId);
  } catch (error) {
    console.error('Failed to recompute grounded semantics:', error);
    // Don't fail the request, but log the error
  }

  return NextResponse.json(
    {
      ok: true,
      edge: { id: edge.id },
      conflictApplication: { id: conflictApp.id },
      fromArgumentId: fromId,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    }
  );
}
