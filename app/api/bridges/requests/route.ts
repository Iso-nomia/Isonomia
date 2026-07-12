export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { writeLogbook } from '@/lib/governance/writers';

const CreateSchema = z.object({
  deliberationId: z.string(),
  requestedById: z.string(),
  targetClusterId: z.string(),
  roomId: z.string(),
  expiresAt: z.string().datetime().optional(), // ISO
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({}));
  const p = CreateSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const { deliberationId, requestedById, targetClusterId, roomId, expiresAt } = p.data;

  const created = await prisma.bridgeRequest.create({
    data: {
      deliberationId,
      requestedById,
      targetClusterId,
      status: 'open',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true },
  });

  await writeLogbook({
    roomId,
    entryType: 'NOTE',
    summary: `Bridge requested (cluster=${targetClusterId}) for deliberation ${deliberationId}`,
    payload: { requestId: created.id, deliberationId, targetClusterId },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
