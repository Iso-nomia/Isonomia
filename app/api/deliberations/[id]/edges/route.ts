export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { maybeUpsertClaimEdgeFromArgumentEdge } from '@/lib/deepdive/claimEdgeHelpers';


const Body = z.object({
  fromArgumentId: z.string(),
  toArgumentId: z.string(),
  type: z.enum(['support', 'rebut', 'undercut', 'concede']),
  targetScope: z.enum(['conclusion', 'premise', 'inference']).optional(),
    targetInferenceId: z.string().optional(),             // NEW
  inferenceId: z.string().optional(),   // NEW

});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deliberationId = params.id;
    const body = Body.parse(await req.json());

    // Verify both args belong to this deliberation
    const [fromArg, toArg] = await Promise.all([
      prisma.argument.findUnique({ where: { id: body.fromArgumentId }, select: { deliberationId: true } }),
      prisma.argument.findUnique({ where: { id: body.toArgumentId }, select: { deliberationId: true } }),
    ]);

    if (!fromArg || !toArg) {
      return NextResponse.json({ error: 'Argument(s) not found' }, { status: 404 });
    }
    if (fromArg.deliberationId !== deliberationId || toArg.deliberationId !== deliberationId) {
      return NextResponse.json({ error: 'Arguments not in this deliberation' }, { status: 400 });
    }

const edge = await prisma.argumentEdge.create({
  data: {
    deliberationId,
    fromArgumentId: body.fromArgumentId,
    toArgumentId: body.toArgumentId,
    type: body.type as any,
    targetScope: body.type === 'undercut' ? (body.targetScope ?? 'inference') : (body.targetScope ?? 'conclusion'),
    targetInferenceId: body.type === 'undercut' ? (body.targetInferenceId ?? null) : null,
    inferenceId: body.inferenceId ?? null,
    createdById: String(userId),
  },
});


    await maybeUpsertClaimEdgeFromArgumentEdge(edge.id);

    return NextResponse.json({ ok: true, edge });
  } catch (e: any) {
    console.error('[edges.create] failed', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 400 });
  }
}
