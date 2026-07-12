export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deliberationId = searchParams.get('deliberationId') ?? undefined;
  const where = deliberationId ? { deliberationId } : {};
  const rows = await prisma.claimLabel.findMany({
    where,
    select: { claimId: true, label: true, explainJson: true },
  });
  return NextResponse.json({ labels: rows });
}
