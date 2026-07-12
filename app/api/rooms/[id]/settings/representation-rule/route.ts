export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/serverutils';

const Body = z.object({ rule: z.enum(['utilitarian','harmonic','maxcov']) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // TODO: check room admin permissions here
  const { rule } = Body.parse(await req.json());
  await prisma.room.update({ where: { id: params.id }, data: { representationRule: rule } as any });
  return NextResponse.json({ ok: true });
}
