export const dynamic = "force-dynamic";

// app/api/claims/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const deliberationId = req.nextUrl.searchParams.get('deliberationId') ?? '';
  const q = (req.nextUrl.searchParams.get('q') ?? '').toLowerCase();
  if (!deliberationId) return NextResponse.json({ ok:true, claims: [] });

  const claims = await prisma.claim.findMany({
    where: {
      deliberationId,
      ...(q ? { text: { contains: q, mode: 'insensitive' }} : {})
    },
    select: { id:true, text:true },
    take: 500,
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ ok:true, claims });
}
