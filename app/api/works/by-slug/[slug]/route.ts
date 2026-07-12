export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(_req: NextRequest, { params }: { params: { slug: string }}) {
  const w = await prisma.theoryWork.findUnique({
    where: { slug: params.slug },
    select: {
      id: true, slug: true, title: true, theoryType: true, authorId: true,
      status: true, visibility: true, publishedAt: true,
      summary: true, body: true, standardOutput: true,
    },
  });
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, work: w });
}
