export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getUserFromCookies } from '@/lib/serverutils';

const KindsEnum = z.enum([
  'SUPPLIES_PREMISE','REVISES','CHALLENGES','REBUTS','UNDERCUTS','UNDERMINES','SUPPORTS',
  'ALTERNATIVE_TO','EVALUATES', // NEW
]);

const Body = z.object({
  deliberationId: z.string(),
  kind: KindsEnum,
  fromWorkId: z.string().optional(),
  fromClaimId: z.string().optional(),
  toWorkId: z.string().optional(),
  toClaimId: z.string().optional(),
  meta: z.any().optional(), // MCDA snapshot, adequacy blob, etc.
}).refine(b => (b.fromWorkId || b.fromClaimId) && (b.toWorkId || b.toClaimId), {
  message: 'Need a from* and a to* id',
});

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error:'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { deliberationId, fromWorkId, fromClaimId, toWorkId, toClaimId, kind, meta } = parsed.data;


  async function upsertEdge(a?: string, b?: string) {
    if (!(a && b)) return null;
    return prisma.knowledgeEdge.upsert({
      where: { // add a unique on (deliberationId, kind, fromWorkId, toWorkId)
        deliberationId_kind_fromWorkId_toWorkId: { deliberationId, kind, fromWorkId: a, toWorkId: b }
      },
      update: { meta: meta ?? {} },
      create: { deliberationId, kind, fromWorkId: a, toWorkId: b, meta: meta ?? {} },
      select: { id:true }
    });
  }

  if (kind === 'ALTERNATIVE_TO') {
    const e1 = await upsertEdge(fromWorkId, toWorkId);
    const e2 = await upsertEdge(toWorkId, fromWorkId);
    return NextResponse.json({ ok:true, edges:[e1,e2] });
  }

  
  // Optional de-dupe (same from/to/kind)
  const exists = await prisma.knowledgeEdge.findFirst({
    where: { deliberationId, fromWorkId, fromClaimId, toWorkId, toClaimId, kind },
    select: { id: true }
  });
  if (exists) return NextResponse.json({ ok:true, edgeId: exists.id, dedup:true }, { status: 200 });

  const edge = await prisma.knowledgeEdge.create({ data: {
    deliberationId, kind, fromWorkId, fromClaimId, toWorkId, toClaimId, meta
  }});
  return NextResponse.json({ ok:true, edge }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const deliberationId = sp.get('deliberationId') ?? undefined;
  const toWorkId       = sp.get('toWorkId') ?? undefined;
  const fromWorkId     = sp.get('fromWorkId') ?? undefined;
  const kindsParam     = sp.get('kinds') ?? sp.get('kind') ?? undefined;

  const where: any = {};
  if (deliberationId) where.deliberationId = deliberationId;
  if (toWorkId)       where.toWorkId = toWorkId;
  if (fromWorkId)     where.fromWorkId = fromWorkId;
  if (kindsParam) {
    const kinds = kindsParam.split(',').map(s => s.trim()).filter(Boolean);
    where.kind = kinds.length === 1 ? kinds[0] : { in: kinds };
  }

  if (!where.deliberationId && !where.toWorkId && !where.fromWorkId) {
    // keep backward-compat but avoid scanning the world
    return NextResponse.json({ ok:true, edges: [], works: [], claims: [] }, { status: 200 });
  }

  const edges = await prisma.knowledgeEdge.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Hydrate titles minimally
  const workIds = Array.from(new Set(edges.flatMap(e => [e.fromWorkId, e.toWorkId]).filter(Boolean) as string[]));
  const claimIds = Array.from(new Set(edges.flatMap(e => [e.fromClaimId, e.toClaimId]).filter(Boolean) as string[]));

  const [works, claims] = await Promise.all([
    workIds.length ? prisma.theoryWork.findMany({ where: { id: { in: workIds }}, select: { id:true, title:true, theoryType:true }}) : Promise.resolve([]),
    claimIds.length ? prisma.claim.findMany({ where: { id: { in: claimIds }}, select: { id:true, text:true }}) : Promise.resolve([]),
  ]);

  return NextResponse.json({ ok:true, edges, works, claims });
}
