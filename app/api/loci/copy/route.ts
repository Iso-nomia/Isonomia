// app/api/loci/copy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { dialogueId, baseLocus, count = 1 } = await req.json().catch(() => ({}));
  if (!dialogueId || !baseLocus) return NextResponse.json({ error: 'dialogueId, baseLocus required' }, { status: 400 });

  const base = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: baseLocus }});
  if (!base) return NextResponse.json({ error: 'BASE_NOT_FOUND' }, { status: 404 });

  const ext = (base.extJson ?? {}) as any;
  let n = Number(ext.childrenCounter ?? 0);

  const children: string[] = [];
  for (let i = 0; i < count; i++) {
    n += 1;
    children.push(`${baseLocus}.${n}`);
  }

  await prisma.$transaction(async (tx) => {
    // upsert children loci
    for (const p of children) {
      await tx.ludicLocus.upsert({
        where: { dialogueId_path: { dialogueId, path: p } },
        update: {},
        create: { dialogueId, path: p, parentId: base.id },
      });
    }
    await tx.ludicLocus.update({
      where: { id: base.id },
      data: { extJson: { ...(ext||{}), childrenCounter: n } },
    });
  });

  // child -> parent bijection (address-level contraction bookkeeping)
  const bijection = Object.fromEntries(children.map(c => [c, baseLocus]));
  return NextResponse.json({ ok: true, children, bijection });
}
