export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

const Update = z.object({
  title: z.string().min(3).optional(),
  body: z.string().min(1).optional(),
  theoryType: z.enum(['DN','IH','TC','OP']).optional(),
  standardOutput: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const json = await req.json().catch(() => null);
  const parsed = Update.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const work = await prisma.theoryWork.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true, work });
}
