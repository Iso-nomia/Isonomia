export const dynamic = "force-dynamic";

// app/api/arguments/[id]/conclusion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await prisma.argument.findUnique({
    where: { id: params.id },
    select: { conclusionClaimId: true }
  });
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404, ...NO_STORE });

  if (!a.conclusionClaimId) {
    // For freeform RAs with no conclusion pointer
    return NextResponse.json({ id: null, text: '' }, NO_STORE);
  }

  const c = await prisma.claim.findUnique({
    where: { id: a.conclusionClaimId },
    select: { id: true, text: true }
  });
  if (!c) return NextResponse.json({ error: 'Conclusion not found' }, { status: 404, ...NO_STORE });

  return NextResponse.json({ id: c.id, text: c.text ?? '' }, NO_STORE);
}
