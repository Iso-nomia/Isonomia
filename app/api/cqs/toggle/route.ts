export const dynamic = "force-dynamic";

// app/api/cqs/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { suggestionForCQ } from '@/lib/argumentation/cqSuggestions';
import { resolveClaimContext } from '@/lib/server/resolveRoom';
import { createClaimAttack } from '@/lib/argumentation/createClaimAttack';
import { getNLIAdapter } from '@/lib/nli/adapter';
import { emitBus } from '@/lib/server/bus';


const BodySchema = z.object({
  targetType: z.enum(['claim', 'argument']),
  targetId: z.string().min(1),
  schemeKey: z.string().min(1),
  cqKey: z.string().min(1),
  satisfied: z.boolean(),
  deliberationId: z.string().optional(),
  groundsText: z.string().optional(), // Text response/grounds for the CQ

  // Optional convenience for "Attach" button in CQ UI
  attachSuggestion: z.boolean().optional(),
  attackerClaimId: z.string().min(1).optional(),
});

type NliRel = 'entails'|'contradicts'|'neutral';

const NLI_THRESHOLD = 0.72; // conservative; tune later

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    targetId, schemeKey, cqKey, satisfied, groundsText,
    deliberationId: delibFromBody, attachSuggestion, attackerClaimId
  } = parsed.data;

  // Resolve deliberation/room from the claim if possible; fall back to body.deliberationId
  let { deliberationId, roomId } = await resolveClaimContext(targetId);
  if (!deliberationId && delibFromBody) {
    deliberationId = delibFromBody;
    const room = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { roomId: true }
    });
    roomId = room?.roomId ?? null;
  }
  if (!deliberationId) {
    return NextResponse.json({ error: 'Unable to resolve deliberation/room for claim' }, { status: 404 });
  }

  // Scheme must exist
  const scheme = await prisma.argumentScheme.findUnique({
    where: { key: schemeKey }, select: { key: true }
  });
  if (!scheme) {
    return NextResponse.json({ error: 'Unknown schemeKey' }, { status: 400 });
  }

  // 1) Optional: attach suggested attack first (for the "Attach" CTA)
  let edgeCreated = false;
  if (attachSuggestion && !satisfied) {
    const suggest = suggestionForCQ(schemeKey, cqKey);
    if (!suggest) {
      return NextResponse.json({ error: 'No suggestion available for this CQ' }, { status: 400 });
    }
    if (!attackerClaimId) {
      return NextResponse.json({ error: 'attackerClaimId required to attach suggestion' }, { status: 400 });
    }
    await createClaimAttack({
      fromClaimId: attackerClaimId,
      toClaimId: targetId,
      deliberationId,
      suggestion: suggest,
      metaJson: {
        cqKey,
        schemeKey,
        source: 'critical-questions-v3-attach',
      },
    });
    edgeCreated = true;
  }
     // Permission guard: For now, allow any authenticated user to mark CQs satisfied
     // Rationale: CQs are collaborative inquiry tools, not adversarial attacks
     // TODO: Consider adding role-based restrictions if needed (e.g., only participants in deliberation)
     const claim = await prisma.claim.findUnique({
       where: { id: targetId }, select: { createdById: true }
     });
     // Commenting out author-only restriction for CQ satisfaction
     // const isAuthor = String(claim?.createdById) === String(userId);
     // const isModerator = false;
     // if (!isAuthor && !isModerator) {
     //   return NextResponse.json({ ok:false, error:'Only the claim author (or a moderator) can mark CQs satisfied/unsatisfied.' }, { status: 403 });
     // }
   
     // 2) Upsert CQStatus (optimistic write; we might revert if a proof guard fails)
  // 2) Upsert CQStatus (optimistic write; we might revert if guard fails)
  const status = await prisma.cQStatus.upsert({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: 'claim', targetId, schemeKey, cqKey,
      }
    },
    update: { 
      satisfied, 
      groundsText: groundsText ?? undefined, // Only update if provided
      updatedAt: new Date() 
    },
    create: {
      targetType: 'claim', targetId, schemeKey, cqKey,
      satisfied, 
      groundsText: groundsText ?? null, // Store grounds text if provided
      createdById: String(userId), 
      roomId,
    }
  });

  // 3) SOFT GUARD (WARNING): Check proof obligation when marking satisfied:true
  // Changed from hard block to soft suggestion to allow flexibility
  let hasEdge = false;
  let requiredAttack: 'rebut'|'undercut'|null = null;
  let nli: { relation: NliRel; score: number } | null = null;
  let warning: string | null = null;
  let proofMet = false; // Declare outside the if block so it's accessible in return statement

  if (satisfied === true) {
    const suggest = suggestionForCQ(schemeKey, cqKey); // may be null
    requiredAttack = suggest?.type ?? null;

    // Helper: does any inbound attack exist?
    async function anyInboundAttack() {
             const e = await prisma.claimEdge.findFirst({
               where: {
                 toClaimId: targetId,
                 OR: [
                   { type: 'rebuts' },              // classic rebut
                   { attackType: 'UNDERCUTS' },     // specific undercut
                 ],
               },
               select: { id: true }
             });
             return !!e;
           }

    if (requiredAttack === 'rebut') {
      // Need an inbound rebut OR strong NLI contradiction (if attacker is known)
      const e = await prisma.claimEdge.findFirst({
        where: {
          toClaimId: targetId,
          OR: [{ type: 'rebuts' }, { attackType: 'REBUTS' as any }],
        },
        select: { id: true, fromClaimId: true }
      });
      hasEdge = !!e;

      if (!hasEdge && attackerClaimId) {
        // Run NLI only if we actually know who’s rebutting
        const adapter = getNLIAdapter();
        const [att, tgt] = await Promise.all([
          prisma.claim.findUnique({ where: { id: attackerClaimId }, select: { text: true } }),
          prisma.claim.findUnique({ where: { id: targetId },        select: { text: true } }),
        ]);
        if (att?.text && tgt?.text) {
          const [res] = await adapter.batch([{ premise: att.text, hypothesis: tgt.text }]);
          nli = res as { relation: NliRel; score: number };

          // Cache cheap, ignore dup errors
          await prisma.nLILink.create({
            data: {
              fromId: attackerClaimId, toId: targetId,
              relation: nli.relation, score: nli.score, createdById: String(userId),
            },
          }).catch(() => null);
        }
      }
    } else if (requiredAttack === 'undercut') {
             // Require an inbound undercut edge (prefer inference scope; optional)
             const e = await prisma.claimEdge.findFirst({
               where: { toClaimId: targetId, attackType: 'UNDERCUTS' /*, targetScope: 'inference' */ },
               select: { id: true }
             });
      hasEdge = !!e;
      nli = null; // not used for undercuts
    } else {
      // No specific attack type—accept any inbound attack
      hasEdge = await anyInboundAttack();
    }

    proofMet =
      hasEdge ||
      (requiredAttack === 'rebut' && nli?.relation === 'contradicts' && (nli?.score ?? 0) >= NLI_THRESHOLD);

    // ✅ SOFT GUARD: Set warning but allow operation to proceed
    if (!proofMet) {
      warning = requiredAttack 
        ? `Suggestion: Consider attaching a ${requiredAttack === 'rebut' ? 'contradicting claim' : 'inference challenge'} to strengthen this answer.`
        : 'Suggestion: Consider providing supporting evidence to strengthen this answer.';
    }
  }
  emitBus('dialogue:moves:refresh', { deliberationId });
  return NextResponse.json({
    ok: true,
    status,
    edgeCreated,
    warning, // ✅ Include warning message (null if proof met)
    guard: {
      requiredAttack,
      hasEdge,
      proofMet, // ✅ Boolean indicating if proof obligation was met
      nliRelation: nli?.relation ?? null,
      nliScore: nli?.score ?? null,
      nliThreshold: NLI_THRESHOLD,
    },
  });
}
