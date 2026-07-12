// app/api/works/[id]/dn/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getUserFromCookies } from '@/lib/serverutils';
import { canEditWorkOrClaimOrphan } from '@/lib/permissions/canEditWork';


export const dynamic = 'force-dynamic';

const Body = z.object({
  explanandum: z.string().optional().nullable(),
  nomological: z.string().optional().nullable(),
  ceterisParibus: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }:{ params:{ id:string }}) {
  const dn = await prisma.workDNStructure.findUnique({ where: { workId: params.id }});
  return NextResponse.json({ ok:true, dn: dn ?? null });
}

export async function PUT(req: NextRequest, { params }:{ params:{ id:string }}) {
  const user = await getUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error:'Unauthorized' }, { status: 401 });

  const work = await prisma.theoryWork.findUnique({ where: { id: params.id }});
  if (!work) return NextResponse.json({ error:'Work not found' }, { status: 404 });
  if (String(work.authorId) !== String(user.userId)) {
    return NextResponse.json({ error:'Forbidden' }, { status: 403 });
  }

    // ✅ author/orphan check
    const perm = await canEditWorkOrClaimOrphan(params.id, String(user.userId));
    if (!perm.ok) {
      const code = perm.reason === 'not-found' ? 404 : 403;
      return NextResponse.json({ error: perm.reason === 'not-found' ? 'Work not found' : 'Forbidden' }, { status: code });
    }

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const saved = await prisma.workDNStructure.upsert({
    where: { workId: params.id },
    create: { workId: params.id, ...body.data },
    update: { ...body.data },
  });
  return NextResponse.json({ ok:true, dn: saved });
}
