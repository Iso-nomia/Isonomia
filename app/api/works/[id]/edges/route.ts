// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';
// import { z } from 'zod';

// const Create = z.object({
//   kind: z.enum([
//     'SUPPLIES_PREMISE','REVISES','CHALLENGES','SUPPORTS','REBUTS','UNDERCUTS','UNDERMINES',
//     'ALTERNATIVE_TO','EVALUATES','REASON_FOR','REASON_AGAINST','NOT_REASON_FOR','NOT_REASON_AGAINST',
//     'CONCLUSIVE_ABOUT','INCONCLUSIVE_ABOUT','ENTAILS'
//   ]),
//   fromWorkId: z.string().optional(),
//   toWorkId: z.string().optional(),
//   fromClaimId: z.string().optional(),
//   toClaimId: z.string().optional(),
//   meta: z.any().optional(),
//   // optional: explicit origin deliberation, else use the Work's home deliberation
//   deliberationId: z.string().optional(),
// });

// export async function GET(_req: NextRequest, { params }:{ params:{ id:string }}) {
//   const edges = await prisma.knowledgeEdge.findMany({
//     where: { OR: [{ fromWorkId: params.id }, { toWorkId: params.id }] },
//     orderBy: { createdAt: 'desc' },
//   });
//   return NextResponse.json({ ok:true, edges });
// }

// export async function POST(req: NextRequest, { params }:{ params:{ id:string }}) {
//   const body = Create.parse(await req.json());
//   const host = await prisma.theoryWork.findUnique({ where: { id: params.id }, select: { deliberationId: true }});
//   if (!host) return NextResponse.json({ error:'Work not found' }, { status: 404 });

//   const edge = await prisma.knowledgeEdge.create({
//     data: {
//       deliberationId: body.deliberationId ?? host.deliberationId,
//       kind: body.kind, meta: body.meta,
//       fromWorkId: body.fromWorkId, toWorkId: body.toWorkId,
//       fromClaimId: body.fromClaimId, toClaimId: body.toClaimId,
//     }
//   });
//   return NextResponse.json({ ok:true, edge });
// }
// app/api/works/[id]/edges/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string }}) {
  const work = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: { deliberationId: true }
  });
  if (!work) return NextResponse.json({ error:'Work not found' }, { status: 404 });

  const mode = req.nextUrl.searchParams.get('mode') ?? 'all'; // 'work' | 'claims' | 'all'
  const claimsInDelib = work.deliberationId
    ? await prisma.claim.findMany({ where: { deliberationId: work.deliberationId }, select: { id:true } })
    : [];

  const where =
    mode === 'work'
      ? { OR: [{ toWorkId: params.id }, { fromWorkId: params.id }] }
      : mode === 'claims'
      ? { toClaimId: { in: claimsInDelib.map(c => c.id) } }
      : {
          OR: [
            { toWorkId: params.id }, { fromWorkId: params.id },
            { toClaimId: { in: claimsInDelib.map(c => c.id) } },
          ],
        };

  const edges = await prisma.knowledgeEdge.findMany({ where, orderBy: { createdAt: 'desc' } });

  // hydrate minimal titles for convenience
  const workIds = Array.from(new Set(edges.flatMap(e => [e.fromWorkId, e.toWorkId]).filter(Boolean) as string[]));
  const claimIds = Array.from(new Set(edges.flatMap(e => [e.fromClaimId, e.toClaimId]).filter(Boolean) as string[]));
  const [works, claims] = await Promise.all([
    workIds.length ? prisma.theoryWork.findMany({ where: { id: { in: workIds } }, select: { id:true, title:true, theoryType:true }}) : Promise.resolve([]),
    claimIds.length ? prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id:true, text:true }}) : Promise.resolve([]),
  ]);

  return NextResponse.json({ ok:true, edges, works, claims });
}
