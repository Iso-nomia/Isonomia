export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

const CreateSchema = z.object({
  roomId: z.string(),
  title: z.string().min(3),
  createdById: z.string(),
  visibility: z.enum(['public','unlisted','room_only']).optional().default('public'),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'').slice(0,80);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({}));
  const p = CreateSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const { roomId, title, createdById, visibility } = p.data;
  let slug = slugify(title);
  const clash = await prisma.brief.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2,6)}`;

  const brief = await prisma.brief.create({
    data: { roomId, title, slug, status: 'draft', visibility, createdById },
    select: { id: true, slug: true },
  });

  return NextResponse.json({ ok: true, id: brief.id, slug: brief.slug });
}
