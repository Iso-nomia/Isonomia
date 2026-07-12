export const dynamic = "force-dynamic";

// API route to add a rebuttal to a claim
//app/api/claims/[id]/rebut/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import crypto from 'crypto';
// import { bus } from '@/lib/bus';
import  bus, { emitBus }  from '@/lib/server/bus';


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const toClaimId = params.id;
  const { text, fromClaimId, scope, createdById, deliberationId } = await req.json() as {
    text?: string; fromClaimId?: string; scope?: 'conclusion' | 'premise'; createdById: string; deliberationId: string;
  };
  const target = await prisma.claim.findUnique({ where: { id: toClaimId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  let rebutId = fromClaimId;
  if (!rebutId) {
    if (!text?.trim()) return NextResponse.json({ error: 'Provide rebuttal text or fromClaimId' }, { status: 400 });
    const moid = crypto.createHash('sha256').update(text.trim()).digest('hex');
    const rebut = await prisma.claim.upsert({
      where: { moid },
      update: {},
      create: { text: text.trim(), createdById, deliberationId, moid },
    });
    rebutId = rebut.id;
  }

  await prisma.claimEdge.upsert({
    where: {
      unique_from_to_type_attack: {
        fromClaimId: rebutId!,
        toClaimId: toClaimId,
        type: 'rebuts',
        attackType: 'REBUTS',
      },
    },
    update: { targetScope: scope ?? 'conclusion' },
    create: {
      deliberationId,
      fromClaimId: rebutId!,
      toClaimId,
      type: 'rebuts',
      attackType: 'REBUTS',
      targetScope: scope ?? 'conclusion',
    },
  });
  emitBus('claims:edges:changed', { deliberationId, toClaimId });
  return NextResponse.json({ ok: true, fromClaimId: rebutId, toClaimId, scope: scope ?? 'conclusion' });
}
