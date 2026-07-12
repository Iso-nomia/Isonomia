export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deliberationId = searchParams.get('deliberationId') ?? undefined;
  const labels = await prisma.claimLabel.findMany({
    where: deliberationId ? { deliberationId } : {},
    select: { claimId: true, label: true, explainJson: true },
  });
  return NextResponse.json({ labels });
}
