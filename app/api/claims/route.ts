export const dynamic = "force-dynamic";

// API route to create or promote a claim
//app/api/claims/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
import { mintUrn } from '@/lib/ids/urn';
import { getCurrentUserId } from '@/lib/serverutils';
import { maybeUpsertClaimEdgeFromArgumentEdge } from '@/lib/deepdive/claimEdgeHelpers';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';
import type { EntityCode } from '@/lib/ids/urn';

// Canonical claim-type enum, mirroring `AcademicClaimType` in lib/models/schema.prisma.
// `Claim.claimType` is stored as `String?` for backward compat, but new writes
// must validate against this enum so downstream consumers can rely on it.
const ClaimTypeEnum = z.enum([
  "THESIS",
  "INTERPRETIVE",
  "HISTORICAL",
  "CONCEPTUAL",
  "NORMATIVE",
  "METHODOLOGICAL",
  "COMPARATIVE",
  "CAUSAL",
  "META",
  "EMPIRICAL",
]);

const PromoteSchema = z.object({
  deliberationId: z.string().optional(),
  text: z.string().min(1).optional(),
  claimType: ClaimTypeEnum.optional(),
  target: z
    .object({
      type: z.enum(['argument', 'card']),
      id: z.string(),
    })
    .optional(),
});

async function getTextFromTarget(target?: { type: 'argument' | 'card'; id: string }) {
  if (!target) return null;
  if (target.type === 'argument') {
        const a = await prisma.argument.findUnique({
            where: { id: target.id },
            select: { text: true, claimId: true, deliberationId: true },
          });
          return a?.text ?? null;
  }
  if (target.type === 'card') {
    const c = await prisma.deliberationCard.findUnique({
      where: { id: target.id },
      select: { claimText: true },
    });
    return c?.claimText ?? null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Back-compat: normalize {targetArgumentId} -> {target:{type:'argument', id}}
    const normalized = body?.targetArgumentId
      ? { ...body, target: { type: 'argument', id: String(body.targetArgumentId) } }
      : body;
    const input = PromoteSchema.parse(normalized);

    let text = input.text ?? null;
    if (!text) text = await getTextFromTarget(input.target);
    if (!text) {
      return NextResponse.json({ error: 'No text found to promote' }, { status: 400 });
    }

    const createdById = await getCurrentUserId();
    if (!createdById) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const moid = mintClaimMoid(text);
    const existing = await prisma.claim.findUnique({ where: { moid } });
    if (existing) {
      console.log('[claims/create] Found existing claim with same moid:', { id: existing.id, text: text.substring(0, 50) });
            // If promoting an argument, back-link argument to existing claim
      if (input.target?.type === 'argument') {
        await prisma.argument.update({
          where: { id: input.target.id },
          data: { claimId: existing.id },
        });
        // retroactively upsert claimEdges
        const incident = await prisma.argumentEdge.findMany({
          where: {
            OR: [{ fromArgumentId: input.target.id }, { toArgumentId: input.target.id }],
          },
          select: { id: true },
        });
 for (let i = 0; i < incident.length; i += 50) {
   await Promise.all(
     incident.slice(i, i + 50).map(e => maybeUpsertClaimEdgeFromArgumentEdge(e.id))
   );
 }

      }
      return NextResponse.json({ claim: existing, created: false });
    }

    // Resolve deliberationId if not provided
    let deliberationId = input.deliberationId ?? null;
    if (!deliberationId && input.target) {
      if (input.target.type === 'argument') {
        deliberationId = (
                    await prisma.argument.findUnique({
                      where: { id: input.target.id },
                      select: { deliberationId: true },
                    })
                  )?.deliberationId ?? null;
      } else {
        deliberationId = (
          await prisma.deliberationCard.findUnique({
            where: { id: input.target.id },
            select: { deliberationId: true },
          })
        )?.deliberationId ?? null;
      }
    }
    // await recomputeGroundedForDelib(deliberationId);

    const urnValue = mintUrn('claim' as EntityCode, moid);

    // Build claim create payload
    const claim = await prisma.claim.create({
      data: {
        text,
        createdById: createdById.toString(),
        moid,
        claimType: input.claimType ?? null,
        ...(deliberationId ? { deliberation: { connect: { id: deliberationId } } } : {}),
        // If you have a Urn relation:
        urns: {
          create: {
            entityType: 'claim',
            urn: urnValue,
          },
        },
      },
    });

    
    // If this came from an argument, link it  upsert claimEdges
    if (input.target?.type === 'argument') {
      await prisma.argument.update({
        where: { id: input.target.id },
        data: { claimId: claim.id },
      });
      const incident = await prisma.argumentEdge.findMany({
        where: {
          OR: [{ fromArgumentId: input.target.id }, { toArgumentId: input.target.id }],
        },
        select: { id: true },
      });
      for (const e of incident) {
        await maybeUpsertClaimEdgeFromArgumentEdge(e.id);
      }
    }

    console.log('[claims/create] Successfully created claim:', { id: claim.id, text: text.substring(0, 50), deliberationId });
    return NextResponse.json({ claim, created: true });
  } catch (err: any) {
    console.error('[claims/create] failed', err);
    return NextResponse.json({ error: err?.message ?? 'Invalid request' }, { status: 400 });
  }
}
