// app/api/works/[id]/tc/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getUserFromCookies } from '@/lib/serverutils';
import { canEditWorkOrClaimOrphan } from '@/lib/permissions/canEditWork';

export const dynamic = 'force-dynamic';

const Body = z.object({
  instrumentFunction: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  applications: z.array(z.string()).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }:{ params:{ id:string }}) {
  const tc = await prisma.workTCTheses.findUnique({ where: { workId: params.id }});
  return NextResponse.json({ ok:true, tc: tc ?? null });
}

export async function PUT(req: NextRequest, { params }:{ params:{ id:string }}) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 });

  const work = await prisma.theoryWork.findUnique({ where: { id: params.id }});
  if (!work) return NextResponse.json({ error:'Work not found' }, { status: 404 });
  if (String(work.authorId) !== String(user.userId)) {
    return NextResponse.json({ error:'Forbidden' }, { status: 403 });
  }

  const perm = await canEditWorkOrClaimOrphan(params.id, String(user.userId));
  if (!perm.ok) {
    const code = perm.reason === 'not-found' ? 404 : 403;
    return NextResponse.json({ error: perm.reason === 'not-found' ? 'Work not found' : 'Forbidden' }, { status: code });
  }

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const data = {
    instrumentFunction: body.data.instrumentFunction ?? undefined,
    explanation: body.data.explanation ?? undefined,
    applications: body.data.applications ?? undefined,
  };

  const saved = await prisma.workTCTheses.upsert({
    where: { workId: params.id },
    create: { workId: params.id, ...data },
    update: { ...data },
  });
  return NextResponse.json({ ok:true, tc: saved });
}
