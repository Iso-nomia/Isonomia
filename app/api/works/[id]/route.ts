// app/api/works/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { canEditWorkOrClaimOrphan } from '@/lib/permissions/canEditWork';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string }}) {
  const w = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: { id: true, deliberationId: true, title: true, theoryType: true, integrityValid: true, status: true },
  });
  if (!w) return NextResponse.json({ error:'not found' }, { status: 404 });
  return NextResponse.json({ ok:true, work: w });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string }}) {
  const json = await req.json().catch(() => ({}));
  const w = await prisma.theoryWork.update({
    where: { id: params.id },
    data: {
      title: json.title,
      summary: json.summary,
      body: json.body,
      standardOutput: json.standardOutput,
      visibility: json.visibility,   // 'room' | 'org' | 'public'
      status: json.status,           // 'DRAFT'|'ACTIVE'|'PUBLISHED'|'ARCHIVED'
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: w.id });
}


export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 });

  const perm = await canEditWorkOrClaimOrphan(params.id, String(user.userId));
  if (!perm.ok) {
    const code = perm.reason === 'not-found' ? 404 : 403;
    return NextResponse.json({ error: perm.reason === 'not-found' ? 'Work not found' : 'Forbidden' }, { status: code });
  }

  const body = await req.json().catch(()=> ({} as any));
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error:'invalid_title' }, { status: 400 });

  await prisma.theoryWork.update({ where: { id: params.id }, data: { title } });
  return NextResponse.json({ ok:true });
}
