export const dynamic = "force-dynamic";

// app/api/dialogue/panel/delocate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';
import { createDecisionReceipt } from '@/lib/decisions/createReceipt';
import { cloneDesignWithShift } from '@/packages/ludics-engine/delocate';
import { prisma } from '@/lib/prismaclient';
import { emitBus } from '@/lib/server/bus';

const Body = z.object({
  deliberationId: z.string().min(1),
  sourceDesignId: z.string().min(10),
  tag: z.string().min(1).max(16).regex(/^[A-Za-z0-9_-]+$/),
  rationale: z.string().min(3),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const parsed = Body.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status:400 });

  const { deliberationId, sourceDesignId, tag, rationale } = parsed.data;

  // Verify the design belongs to this dialogue
  const src = await prisma.ludicDesign.findUnique({ where: { id: sourceDesignId }, select: { deliberationId: true }});
  if (!src || src.deliberationId !== deliberationId) {
    return NextResponse.json({ error:'DESIGN_MISMATCH' }, { status:400 });
  }

  // Perform the delocation (clone+shift)
  
  const clone = await cloneDesignWithShift(sourceDesignId, tag);

  // Write a procedural receipt
  const rec = await createDecisionReceipt({
    deliberationId,
    kind: 'procedural',
    subject: { type:'locus', id:'0' },                // you can also store '0.tag' if you prefer
    issuedBy: { who:'panel', byId: String(userId) },
    rationale,
    inputs: {
      action: 'delocate',
      sourceDesignId,
      newDesignId: clone.id,
      from: '0',
      to: clone.base,  // "0.tag"
      tag,
    },
  });

  // Let clients refresh
  emitBus('dialogue:moves:refresh', { deliberationId });

  return NextResponse.json({ ok:true, design: clone, receipt: rec }, { headers: { 'Cache-Control':'no-store' }});
}
