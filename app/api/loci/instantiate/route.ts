// app/api/loci/instantiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { dialogueId, baseLocus, name, mask=true } = await req.json().catch(()=>({}));
  if (!dialogueId || !baseLocus || !name) return NextResponse.json({ error:'dialogueId, baseLocus, name required' }, { status:400 });

  const base = await prisma.ludicLocus.findFirst({ where:{ dialogueId, path: baseLocus }});
  if (!base) return NextResponse.json({ error:'BASE_NOT_FOUND' }, { status:404 });

  const child = `${baseLocus}.${name}`;
  await prisma.ludicLocus.upsert({
    where:{ dialogueId_path:{ dialogueId, path: child }},
    update:{},
    create:{ dialogueId, path: child, parentId: base.id },
  });

  // stash a mask hint on the child (optional)
  if (mask) {
    await prisma.ludicLocus.update({ where:{ id: base.id }, data:{ extJson:{ ...(base.extJson as any || {}), maskedNames: [...new Set([...(base.extJson as any)?.maskedNames || [], name])] } }});
  }
  return NextResponse.json({ ok:true, child, masked:mask });
}
