// app/api/kb/pages/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

async function loadPageBasic(id: string) {
  return prisma.kbPage.findUnique({
    where: { id },
    select: { id: true, title: true, spaceId: true, createdById: true, updatedAt: true, summary: true, tags: true, frontmatter: true },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await loadPageBasic(params.id);
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await requireKbRole(req, { spaceId: row.spaceId, need: 'reader' });

    let canEdit = false;
    try { await requireKbRole(req, { spaceId: row.spaceId, need: 'editor' }); canEdit = true; } catch {}

    return NextResponse.json({ ok: true, page: { ...row, canEdit } }, NO_STORE);
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await loadPageBasic(params.id);
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    await requireKbRole(req, { spaceId: row.spaceId, need: 'editor' });

    const body = await req.json().catch(() => ({} as any));
    const data: any = {};
    if (typeof body?.title === 'string') data.title = body.title.trim();
    if (typeof body?.summary === 'string' || body?.summary === null) data.summary = body.summary ?? null;
    if (Array.isArray(body?.tags)) data.tags = body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 16);
    if (body?.frontmatter && typeof body.frontmatter === 'object') data.frontmatter = body.frontmatter;

    if (!Object.keys(data).length) return NextResponse.json({ ok: true, page: { id: params.id } }, NO_STORE);

    const updated = await prisma.kbPage.update({
      where: { id: params.id },
      data,
      select: { id: true, title: true, summary: true, tags: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, page: updated }, NO_STORE);
  } catch (e) {
    return fail(e);
  }
}
