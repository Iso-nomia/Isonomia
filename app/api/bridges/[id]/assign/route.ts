export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await prisma.bridgeAssignment.create({
    data: { requestId: params.id, assigneeId: String(uid) },
  });
  await prisma.bridgeRequest.update({ where: { id: params.id }, data: { status: 'assigned' } });
  return NextResponse.json({ ok: true, assignment: row });
}
