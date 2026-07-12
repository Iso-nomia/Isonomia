export const dynamic = "force-dynamic";

// app/api/works/by-ids/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ ok:true, works: []});
const works = await prisma.theoryWork.findMany({
  where: { id: { in: ids } },
  select: { id:true, title:true, slug:true, theoryType:true }
});
  return NextResponse.json({ ok:true, works });
}
