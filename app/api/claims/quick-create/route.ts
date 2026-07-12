import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { resolveClaimContext } from '@/lib/server/resolveRoom';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Body = z.object({
  // Text is optional in promotion mode; we can fall back to the argument text
  text: z.string().min(1).optional(),

  // Any of these can be provided; we derive deliberationId safely below
  deliberationId: z.string().min(5).optional(),
  targetClaimId: z.string().min(5).optional(),
  targetArgumentId: z.string().min(5).optional(),

  // Optional: create an edge kind when targetClaimId is present
  edgeKind: z.enum(['supports','attacks']).optional(),
}).refine(
  (d) => !!(d.targetClaimId || d.targetArgumentId || d.deliberationId),
  { message: 'Provide targetClaimId, targetArgumentId, or deliberationId' }
);

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { deliberationId: bodyDelibId, targetClaimId, targetArgumentId, text: bodyText, edgeKind = 'supports' } = parsed.data;

  // ---- Derive effective deliberation & idempotence checks ----
  let effectiveDelibId = bodyDelibId || '';

  // If promoting an argument, prefer using its room and detect existing claim
  let existingClaimId: string | null = null;
  let fallbackText = bodyText;

  if (targetArgumentId) {
    const arg = await prisma.argument.findUnique({
      where: { id: targetArgumentId },
      select: { id: true, text: true, claimId: true, deliberationId: true },
    });
    if (!arg) return NextResponse.json({ error: 'Argument not found' }, { status: 404 });

    // Room guard/match (if caller also sent one)
    if (bodyDelibId && bodyDelibId !== arg.deliberationId) {
      return NextResponse.json({ error: 'deliberationId mismatch with targetArgumentId' }, { status: 409 });
    }

    effectiveDelibId = arg.deliberationId;
    fallbackText = fallbackText || arg.text || '—';

    if (arg.claimId) {
      // Idempotent return: already promoted
      existingClaimId = arg.claimId;
    }
  }

  // If linking to a target claim, derive room from it and guard mismatch
  if (targetClaimId) {
    const ctx = await resolveClaimContext(targetClaimId).catch(() => null);
    const targetDelibId = ctx?.deliberationId;
    if (!targetDelibId) {
      return NextResponse.json({ error: 'Unable to resolve deliberation for targetClaimId' }, { status: 404 });
    }
    if (effectiveDelibId && effectiveDelibId !== targetDelibId) {
      return NextResponse.json({ error: 'deliberationId mismatch with targetClaimId' }, { status: 409 });
    }
    effectiveDelibId = targetDelibId;
  }

  // Final guard
  if (!effectiveDelibId) {
    return NextResponse.json({ error: 'Missing deliberationId' }, { status: 400 });
  }

  // If we already have a claim by promotion, return it now (no-op creation)
  if (existingClaimId) {
    return NextResponse.json({ ok: true, claimId: existingClaimId, deliberationId: effectiveDelibId }, { status: 200 });
  }

  // ---- Create claim (+ optional link) atomically ----
  const created = await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.create({
      data: {
        text: (bodyText || fallbackText || '').trim() || '—',
        createdById: String(userId),
        deliberationId: effectiveDelibId,
        moid: `cq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      select: { id: true },
    });

    // If this is a promotion, attach claim to the argument (one-time link)
    if (targetArgumentId) {
      await tx.argument.update({
        where: { id: targetArgumentId },
        data: { claimId: claim.id },
      });
    }

    // If we’re also asked to relate to another claim, add an edge (same room)
    if (targetClaimId) {
      // If your schema uses fromClaimId/toClaimId, rename accordingly:
         const typeEnum = edgeKind === 'attacks' ? 'rebuts' : 'supports';
   const attackEnum = edgeKind === 'attacks' ? 'REBUTS' : 'SUPPORTS';
   await tx.claimEdge.upsert({
     where: {
       unique_from_to_type_attack: {
         fromClaimId: claim.id,
         toClaimId: targetClaimId,
         type: typeEnum,
         attackType: attackEnum,
       },
     },
     update: {},
     create: {
       deliberationId: effectiveDelibId,
       fromClaimId: claim.id,
       toClaimId: targetClaimId,
       type: typeEnum,
       attackType: attackEnum,
       targetScope: typeEnum === 'rebuts' ? 'conclusion' : null,
     },
   });
    }

    return claim;
 }, { timeout: 8000 });

  return NextResponse.json(
    { ok: true, claimId: created.id, deliberationId: effectiveDelibId },
    { status: 201 }
  );
}
