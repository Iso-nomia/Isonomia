export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { asUserIdString } from '@/lib/auth/normalize';

const Body = z.object({
  argumentId: z.string().min(1),
  approve: z.boolean().default(true),
});


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rawUserId = (await getCurrentUserId())?.toString();
  if (!rawUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = asUserIdString(rawUserId);                  // 👈 use consistently

  const deliberationId = params.id;
  const { argumentId, approve } = Body.parse(await req.json());

  // Prevent cross-deliberation approvals
  const exists = await prisma.argument.findFirst({ where: { id: argumentId, deliberationId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'Argument not in this deliberation' }, { status: 400 });

  if (approve) {
    await prisma.argumentApproval.upsert({
      where: { argumentId_userId: { argumentId, userId } },
      create: { deliberationId, argumentId, userId },
      update: {},
    });
  } else {
    await prisma.argumentApproval.deleteMany({ where: { argumentId, userId } });
  }
  return NextResponse.json({ ok: true });
}