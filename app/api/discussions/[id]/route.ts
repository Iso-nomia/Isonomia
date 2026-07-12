import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { z } from 'zod';
import { jsonSafe } from '@/lib/bigintjson';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PatchZ = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const row = await prisma.discussion.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, description: true, createdById: true, createdAt: true, updatedAt: true },
  });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(jsonSafe({ ok: true, discussion: row }), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const row = await prisma.discussion.findUnique({
    where: { id: params.id },
    select: { id: true, createdById: true },
  });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(row.createdById) !== String(uid)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = PatchZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request', detail: parsed.error.flatten() }, { status: 400 });
  }
  const data: any = {};
  if (typeof parsed.data.title === 'string') data.title = parsed.data.title;
  if ('description' in parsed.data) data.description = parsed.data.description ?? null;
  if (!Object.keys(data).length) return NextResponse.json({ ok: true });

  const updated = await prisma.discussion.update({
    where: { id: params.id },
    data,
    select: { id: true, title: true, description: true, updatedAt: true },
  });

  return NextResponse.json(jsonSafe({ ok: true, discussion: updated }), { headers: { 'Cache-Control': 'no-store' } });
}
