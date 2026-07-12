// app/api/works/[id]/supplies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string }}) {
  const work = await prisma.theoryWork.findUnique({ where: { id: params.id }, select: { deliberationId: true } });
  if (!work) return NextResponse.json({ ok:false, error:'Work not found' }, { status: 404 });

  const claimsInDelib = await prisma.claim.findMany({
    where: { deliberationId: work.deliberationId },
    select: { id:true },
  });

const mode = _req.nextUrl.searchParams.get('mode') ?? 'all'; // 'work' | 'claims' | 'all'
const where = mode === 'work' ? { OR: [{ toWorkId: params.id }, { fromWorkId: params.id }] } :
             mode === 'claims' ? { toClaimId: { in: claimsInDelib.map(c => c.id) } } :
             { OR: [{ toWorkId: params.id }, { fromWorkId: params.id }, { toClaimId: { in: claimsInDelib.map(c => c.id) } }] };
const edges = await prisma.knowledgeEdge.findMany({ where, orderBy: { createdAt: 'desc' }});


  // const edges = await prisma.knowledgeEdge.findMany({
  //   where: {
  //     OR: [
  //       { toWorkId: params.id },
  //       { toClaimId: { in: claimsInDelib.map(c => c.id) } },
  //     ],
  //   },
  //   orderBy: { createdAt: 'desc' },
  // });

  // Optionally hydrate minimal titles
  const workIds = Array.from(new Set(edges.flatMap(e => [e.fromWorkId, e.toWorkId]).filter(Boolean) as string[]));
  const claimIds = Array.from(new Set(edges.flatMap(e => [e.fromClaimId, e.toClaimId]).filter(Boolean) as string[]));

  const [works, claims] = await Promise.all([
    prisma.theoryWork.findMany({ where: { id: { in: workIds } }, select: { id:true, title:true, theoryType:true }}),
    prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id:true, text:true }}),
  ]);
  return NextResponse.json({ ok:true, edges, works, claims });
}
