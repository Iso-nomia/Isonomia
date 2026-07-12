export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {  $Enums } from '@prisma/client';
import { prisma } from '@/lib/prismaclient';

const Body = z.object({
  fromId: z.string().min(6),
  toId: z.string().min(6),
  kind: z.enum([
    'supports','rebuts','objects','undercuts',
    'refines','restates','clarifies','depends_on'
  ]),
  thread: z.string().optional(),
  ord: z.number().int().positive().optional(),
  rationale: z.string().optional()
});

type BodyT = z.infer<typeof Body>;

const toAF = (k: BodyT['kind']): $Enums.DebateEdgeKind => {
  if (k === 'supports')  return 'supports';
  if (k === 'undercuts') return 'undercuts';
  // Treat 'rebuts' and 'objects' as rebuttal; everything else buckets to rebuts (non-AF kinds)
  if (k === 'rebuts' || k === 'objects') return 'rebuts';
  return 'rebuts';
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sheetId = params.id;
  const { fromId, toId, kind, thread, ord, rationale } = Body.parse(await req.json());

  // Validate sheet + node membership
  const [sheet, fromNode, toNode] = await Promise.all([
    prisma.debateSheet.findUnique({ where: { id: sheetId }, select: { id: true } }),
    prisma.debateNode.findUnique({ where: { id: fromId }, select: { id: true, sheetId: true } }),
    prisma.debateNode.findUnique({ where: { id: toId   }, select: { id: true, sheetId: true } }),
  ]);
  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
  if (!fromNode || !toNode) return NextResponse.json({ error: 'fromId/toId not found' }, { status: 400 });
  if (fromNode.sheetId !== sheetId || toNode.sheetId !== sheetId) {
    return NextResponse.json({ error: 'Edges must connect nodes within the same sheet' }, { status: 400 });
  }
  if (fromId === toId) {
    return NextResponse.json({ error: 'fromId and toId must differ' }, { status: 400 });
  }

  const nextOrdAgg = await prisma.debateEdge.aggregate({
    where: { sheetId },
    _max: { ord: true }
  });
  const ordVal = ord ?? ((nextOrdAgg._max.ord ?? 0) + 1);

  const edge = await prisma.debateEdge.create({
    data: {
      sheetId,
      fromId,
      toId,
      kind: toAF(kind),        // Prisma enum (singular AF)
      thread: thread ?? null,
      ord: ordVal,
      rationale: rationale ?? null,
    },
    select: { id: true }
  });

  return NextResponse.json({ ok: true, edge }, { headers: { 'Cache-Control': 'no-store' } });
}
