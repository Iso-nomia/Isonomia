export const dynamic = "force-dynamic";

// API route to create or update a warrant for a claim
//app/api/claims/[id]/warrant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = params.id;
  const { text, createdBy } = await req.json() as { text: string; createdBy: string };
  if (!text?.trim()) return NextResponse.json({ error: 'Provide warrant text' }, { status: 400 });

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true } });
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  const w = await prisma.claimWarrant.upsert({
    where: { claimId },
    update: { text },
    create: { claimId, text: text.trim(), createdBy },
  });

  return NextResponse.json({ ok: true, warrantId: w.id });
}
