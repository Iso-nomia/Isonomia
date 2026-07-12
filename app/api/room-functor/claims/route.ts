import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const roomId = String(url.searchParams.get('room') ?? '').trim();
  if (!roomId) {
    return NextResponse.json({ ok: false, error: 'Missing ?room=' }, { status: 400, headers: { 'Cache-Control':'no-store' }});
  }

  // Keep it light; adjust take if needed
  const rows = await prisma.claim.findMany({
    where: { deliberationId: roomId },
    select: { id: true, text: true },
    take: 5000,
    orderBy: { createdAt: 'asc' }
  });

  const names: Record<string,string> = {};
  for (const r of rows) names[r.id] = r.text || '';
  return NextResponse.json({ ok: true, room: roomId, names }, { headers: { 'Cache-Control':'no-store' }});
}
