export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

const Body = z.object({ summaryCardId: z.string().min(1), rewardCare: z.number().int().min(0).max(100).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=> ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { summaryCardId, rewardCare = 0 } = parsed.data;

  await prisma.bridgeAssignment.updateMany({ where: { requestId: params.id, completedAt: null }, data: { completedAt: new Date(), summaryCardId, rewardCare } });
  await prisma.bridgeRequest.update({ where: { id: params.id }, data: { status: 'completed' } });
  return NextResponse.json({ ok: true });
}
