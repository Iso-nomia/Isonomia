export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const Body = z.object({
  quantifier: z.enum(['SOME','MANY','MOST','ALL']).nullable().optional(),
  modality:   z.enum(['COULD','LIKELY','NECESSARY']).nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const argId = params.id;
  const body = await req.json().catch(()=> ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const arg = await prisma.argument.findUnique({
    where: { id: argId },
    select: { authorId: true },
  });
  if (!arg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Author-only policy (extend here for steward override if you add roles)
  if (String(arg.authorId) !== String(userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.argument.update({
    where: { id: argId },
    data: {
      quantifier: parsed.data.quantifier ?? null,
      modality:   parsed.data.modality   ?? null,
    },
    select: { id:true, quantifier:true, modality:true },
  });

  return NextResponse.json({ ok:true, argument: updated });
}
