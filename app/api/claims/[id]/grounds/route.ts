export const dynamic = "force-dynamic";

// API route to add a ground to a claim
//app/api/claims/[id]/grounds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const toClaimId = params.id;
  const { text, fromClaimId, createdById, deliberationId } = await req.json() as {
    text?: string; fromClaimId?: string; createdById: string; deliberationId: string;
  };
  // ensure target exists
  const target = await prisma.claim.findUnique({ where: { id: toClaimId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  // resolve or create the ground claim
  let groundId = fromClaimId;
  if (!groundId) {
    if (!text?.trim()) return NextResponse.json({ error: 'Provide ground text or fromClaimId' }, { status: 400 });
    const moid = crypto.createHash('sha256').update(text.trim()).digest('hex');
    const ground = await prisma.claim.upsert({
      where: { moid },
      update: {},
      create: { text: text.trim(), createdById, deliberationId, moid },
    });
    groundId = ground.id;
  }

  // link ground → claim as SUPPORTS
  await prisma.claimEdge.upsert({
    where: {
      unique_from_to_type_attack: {
        fromClaimId: groundId!,
        toClaimId: toClaimId,
        type: 'supports',
        attackType: 'SUPPORTS',
      },
    },
    update: {},
    create: {
      deliberationId,
      fromClaimId: groundId!,
      toClaimId,
      type: 'supports',
      attackType: 'SUPPORTS',
      targetScope: null,
    },
  });

  return NextResponse.json({ ok: true, fromClaimId: groundId, toClaimId });
}
