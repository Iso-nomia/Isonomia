export const dynamic = "force-dynamic";

// app/api/claims/aif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const deliberationId = u.searchParams.get('deliberationId') || undefined;
  const q = (u.searchParams.get('q') || '').trim();
  const limit = Math.min(50, parseInt(u.searchParams.get('limit') || '12', 10));
  const items = await prisma.claim.findMany({
    where: {
      ...(deliberationId ? { deliberationId } : {}),
      ...(q ? { text: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, text: true },
    take: limit,
  });
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}

const Create = z.object({
  deliberationId: z.string().min(4),
  authorId: z.string().min(1),
  text: z.string().min(2).max(2000),
});

export async function POST(req: NextRequest) {
  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { deliberationId, authorId, text } = parsed.data;
  const c = await prisma.claim.create({ data: { deliberationId, createdById: authorId, text, moid: mintClaimMoid(text) } });
  return NextResponse.json({ ok: true, id: c.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
