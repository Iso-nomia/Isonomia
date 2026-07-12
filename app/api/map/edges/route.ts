export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { asUserIdString } from '@/lib/auth/normalize';

const Kind = z.enum(['supports','rebuts','relates','evidence']);

const PostBody = z.object({
  deliberationId: z.string().min(5),
  fromNodeId: z.string().min(5),
  toNodeId: z.string().min(5),
  kind: Kind.default('relates'),
  meta: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = asUserIdString(userId);

  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { deliberationId, fromNodeId, toNodeId, kind, meta } = parsed.data;

  if (fromNodeId === toNodeId) {
    return NextResponse.json({ error: 'fromNodeId and toNodeId must differ' }, { status: 400 });
  }

  // Ensure both nodes exist and gather their argumentIds
  const [fromAnn, toAnn] = await Promise.all([
    prisma.argumentAnnotation.findUnique({
      where: { id: fromNodeId },
      select: { id:true, targetId:true, type:true, text:true },
    }),
    prisma.argumentAnnotation.findUnique({
      where: { id: toNodeId },
      select: { id:true, targetId:true, type:true, text:true },
    }),
  ]);
  if (!fromAnn || !toAnn) {
    return NextResponse.json({ error: 'One or both nodes not found' }, { status: 404 });
  }

  // Verify both nodes belong to arguments within the same deliberationId
    const args = await prisma.argument.findMany({
        where: { id: { in: [fromAnn.targetId, toAnn.targetId] } },
        select: { id:true, deliberationId:true },
      });
      if (args.length !== 2 || args.some(a => a.deliberationId !== deliberationId)) {
        return NextResponse.json({ error: 'Nodes do not belong to this deliberation' }, { status: 400 });
      }

  // Resolve roomId from deliberation (optional)
  const room = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { roomId: true },
  });

  const edge = await prisma.graphEdge.create({
    data: {
      fromId: fromNodeId,
      toId: toNodeId,
      type: `map:${kind}`,                 // 'map:supports'|'map:rebuts'|'map:relates'|'map:evidence'
      scope: null,
      roomId: room?.roomId ?? 'map',
      createdById: uid,
      meta: {
        ...meta,
        // helpful context for clients
        deliberationId,
        from: { argumentId: fromAnn.targetId, nodeType: fromAnn.type, text: fromAnn.text },
        to:   { argumentId: toAnn.targetId,   nodeType: toAnn.type,   text: toAnn.text   },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: edge.id });
}
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const deliberationId = url.searchParams.get('deliberationId') || '';
    const nodeIdsCsv = url.searchParams.get('nodeIds') || '';
    const kindsCsv = url.searchParams.get('kinds') || ''; // e.g., "supports,rebuts"
  
    let nodeIds: string[] = [];
    if (nodeIdsCsv) nodeIds = nodeIdsCsv.split(',').map(s => s.trim()).filter(Boolean);
  
    // Build the base where for GraphEdge.type
    const typeFilter = kindsCsv
      ? kindsCsv.split(',').map(s => s.trim()).filter(Boolean).map(k => `map:${k}`)
      : [];
    const where: any = {
      ...(typeFilter.length ? { type: { in: typeFilter } } : { type: { startsWith: 'map:' } }),
    };
  
    // If deliberationId is present, restrict to edges whose from/to nodes belong to that deliberation.
    // We do this by:
    //  1) Fetch argument ids for the deliberation
    //  2) Fetch map-node annotations whose targetId is in those argument ids
    //  3) Restrict edges to fromId/toId in that annotation-id set
    let allowedNodeIds: string[] | null = null;
//     if (allowedNodeIds && allowedNodeIds.length) {
//   where.fromId = { in: allowedNodeIds };
//   where.toId   = { in: allowedNodeIds };
// } else if (deliberationId) {
//   // no nodes in this deliberation => no edges
//   return NextResponse.json({ ok: true, edges: [] });
// }
    if (deliberationId) {
      const args = await prisma.argument.findMany({
        where: { deliberationId },
        select: { id: true },
        take: 10000,
      });
      const argIds = args.map(a => a.id);
      if (argIds.length === 0) {
        // no arguments → no nodes → no edges
        return NextResponse.json({ ok: true, edges: [] });
      }
  
      const anns = await prisma.argumentAnnotation.findMany({
        where: {
          targetType: 'argument',
          targetId: { in: argIds },
          type: { startsWith: 'map:' },
        },
        select: { id: true },
        take: 10000,
      });
      allowedNodeIds = anns.map(a => a.id);
      if (allowedNodeIds.length === 0) {
        return NextResponse.json({ ok: true, edges: [] });
      }
    }
  
    // Restrict by specific nodeIds if provided
    if (nodeIds.length) {
      where.OR = [{ fromId: { in: nodeIds } }, { toId: { in: nodeIds } }];
    }
  
    // Restrict by allowedNodeIds (from deliberation) if present
    if (allowedNodeIds) {
      const base = where.OR ? where.OR : [];
      where.OR = [
        ...(base as any[]),
        { fromId: { in: allowedNodeIds } },
        { toId:   { in: allowedNodeIds } },
      ];
    }
  
    const edges = await prisma.graphEdge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id:true, fromId:true, toId:true, type:true, scope:true, meta:true, createdAt:true },
      take: 10000,
    });
  
    const out = edges.map(e => ({
      id: e.id,
      fromNodeId: e.fromId,
      toNodeId: e.toId,
      kind: e.type.replace(/^map:/, ''), // 'supports'|'rebuts'|'relates'|'evidence'
      scope: e.scope,
      meta: e.meta,
      createdAt: e.createdAt.toISOString(),
    }));
  
    return NextResponse.json({ ok: true, edges: out });
  }
  