export const dynamic = "force-dynamic";

//app/api/propositions/[id]/endorse/route.ts


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: NextRequest, { params }: { params:{ id:string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...NO_STORE });

  const id = params.id;
  const b = await req.json().catch(()=>({}));
  const desired = typeof b?.on === 'boolean' ? b.on : undefined; // if undefined → toggle

  const out = await prisma.$transaction(async (tx) => {
    const exists = await tx.propositionEndorsement.findUnique({ where: { propositionId_userId: { propositionId: id, userId: String(userId) } } });
    const shouldCreate = desired === undefined ? !exists : desired;

    if (shouldCreate && !exists) {
      await tx.propositionEndorsement.create({ data: { propositionId: id, userId: String(userId) } });
      const p = await tx.proposition.update({ where: { id }, data: { endorseCount: { increment: 1 } }, select: { endorseCount: true } });
      return { endorsed: true, endorseCount: p.endorseCount };
    }
    if (!shouldCreate && exists) {
      await tx.propositionEndorsement.delete({ where: { propositionId_userId: { propositionId: id, userId: String(userId) } } });
      const p = await tx.proposition.update({ where: { id }, data: { endorseCount: { increment: -1 } }, select: { endorseCount: true } });
      return { endorsed: false, endorseCount: p.endorseCount };
    }

    const p = await tx.proposition.findUnique({ where: { id }, select: { endorseCount: true } });
    return { endorsed: !!exists, endorseCount: p?.endorseCount ?? 0 };
  });

  return NextResponse.json({ ok:true, ...out }, NO_STORE);
}
