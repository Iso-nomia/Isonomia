export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';
import { createDecisionReceipt } from '@/lib/decisions/createReceipt';

const GetSchema = z.object({
  deliberationId: z.string().min(1),
  subjectType: z.enum(['claim','locus','view','option','card']),
  subjectId: z.string().min(1),
  limit: z.coerce.number().optional().default(1),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = GetSchema.safeParse({
    deliberationId: url.searchParams.get('deliberationId'),
    subjectType: url.searchParams.get('subjectType'),
    subjectId: url.searchParams.get('subjectId'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { deliberationId, subjectType, subjectId, limit } = parsed.data;
  const rows = await prisma.ludicDecisionReceipt.findMany({
    where: { deliberationId, subjectType, subjectId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  return NextResponse.json({ items: rows });
}

const PostSchema = z.object({
  deliberationId: z.string().min(1),
  kind: z.enum(['epistemic','procedural','allocative','editorial']),
  subject: z.object({ type: z.enum(['claim','locus','view','option','card']), id: z.string().min(1) }),
  rationale: z.string().optional(),
  inputs: z.any(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rec = await createDecisionReceipt({
    deliberationId: parsed.data.deliberationId,
    kind: parsed.data.kind,
    subject: parsed.data.subject,
    issuedBy: { who: 'panel', byId: String(userId) },
    rationale: parsed.data.rationale,
    inputs: parsed.data.inputs ?? {},
  });

  return NextResponse.json({ ok: true, receipt: rec });
}
