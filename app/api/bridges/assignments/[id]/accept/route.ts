export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await prisma.bridgeAssignment.update({
    where: { id: params.id },
    data: { acceptedAt: new Date() },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: a.id });
}
