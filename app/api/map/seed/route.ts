export const dynamic = "force-dynamic";

// app/api/map/seed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

const Q = z.object({ deliberationId: z.string().min(5) });

export async function POST(req: NextRequest) {
  const parsed = Q.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { deliberationId } = parsed.data;

  // 1) arguments in this deliberation
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: { id:true, text:true },
    take: 10_000,
  });

  if (!args.length) return NextResponse.json({ ok:true, seeded: { nodes:0, edges:0 } });

  // any existing map:* annotation ids for these arguments
  const existing = await prisma.argumentAnnotation.findMany({
    where: { targetType:'argument', targetId: { in: args.map(a => a.id) }, type: { startsWith: 'map:' } },
    select: { id:true, targetId:true },
    take: 10_000,
  });
  const hasNode = new Set(existing.map(r => r.targetId));

  // 2) create one map:reason node per argument (only if none exists)
  const toCreate = args.filter(a => !hasNode.has(a.id));
  const createdNodes = await prisma.$transaction(
    toCreate.map(a => prisma.argumentAnnotation.create({
      data: {
        targetType: 'argument',
        targetId: a.id,
        type: 'map:reason',
        offsetStart: 0,
        offsetEnd: Math.min( (a.text ?? '').length, 200 ),
        text: (a.text ?? '').slice(0, 200),
        source: 'seed',
      },
      select: { id:true, targetId:true },
    }))
  ).catch(() => []);

  // lookup annotation id per argumentId (prefer existing > created)
  const annIdByArg = new Map<string,string>();
  for (const r of existing) annIdByArg.set(r.targetId, r.id);
  for (const r of createdNodes) annIdByArg.set(r.targetId, r.id);

  // 3) edges from ArgumentEdge → GraphEdge(map:*), skip if no nodes present
  const aes = await prisma.argumentEdge.findMany({
    where: { deliberationId },
    select: { id:true, fromArgumentId:true, toArgumentId:true, type:true, createdAt:true },
    take: 10_000,
  });

  const toEdge = aes
    .map(e => {
      const fromNodeId = annIdByArg.get(e.fromArgumentId);
      const toNodeId   = annIdByArg.get(e.toArgumentId);
      if (!fromNodeId || !toNodeId) return null;
      const kind = e.type === 'support' ? 'map:supports'
                 : e.type === 'rebut'   ? 'map:rebuts'
                 : 'map:relates';
      return { fromNodeId, toNodeId, kind };
    })
    .filter(Boolean) as Array<{fromNodeId:string; toNodeId:string; kind:string}>;

  // avoid duplicates (same from/to/kind)
  const existingEdges = await prisma.graphEdge.findMany({
    where: { type: { startsWith: 'map:' } },
    select: { fromId:true, toId:true, type:true },
    take: 20_000,
  });
  const seen = new Set(existingEdges.map(e => `${e.fromId}→${e.toId}:${e.type}`));

  const newEdges = toEdge.filter(e => !seen.has(`${e.fromNodeId}→${e.toNodeId}:${e.kind}`));
  if (newEdges.length) {
    await prisma.$transaction(
      newEdges.map(e => prisma.graphEdge.create({
        data: {
          fromId: e.fromNodeId,
          toId: e.toNodeId,
          type: e.kind,
          roomId: deliberationId,     // convenient partition
          createdById: 'seed',
          meta: { deliberationId, seeded: true },
        }
      }))
    ).catch(()=>{});
  }

  return NextResponse.json({
    ok: true,
    seeded: { nodes: createdNodes.length, edges: newEdges.length }
  });
}
