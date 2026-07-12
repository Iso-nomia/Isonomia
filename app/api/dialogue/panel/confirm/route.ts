export const dynamic = "force-dynamic";

// app/api/dialogue/panel/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { emitBus } from '@/lib/server/bus';

const Body = z.object({
  deliberationId: z.string().min(6),
  kind: z.enum(['epistemic','procedural','policy']).default('epistemic'),
  subject: z.object({ type: z.enum(['claim','card','argument']), id: z.string().min(6) }),
  rationale: z.string().min(1),
  inputs: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const { deliberationId, kind, subject, rationale, inputs } = Body.parse(await req.json());

  const row = await prisma.ludicDecisionReceipt.create({
    data: {
      deliberationId,
      kind,
      subjectType: subject.type,
      subjectId: subject.id,
      rationale,
      inputsJson: inputs ?? {},
      issuedBy: `panel:${userId}`,
    },
    select: { id:true, kind:true, subjectType:true, subjectId:true, createdAt:true },
  });

  try { emitBus('decision:changed', { deliberationId }); } catch {}
  return NextResponse.json({ ok:true, receipt: row });
}
