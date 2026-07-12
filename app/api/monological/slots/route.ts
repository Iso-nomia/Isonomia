export const dynamic = "force-dynamic";

// app/api/monological/slots/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

 // Accept both "ground" and "grounds" but normalize to "ground"
 const SlotZ = z.union([
       z.literal('ground'),
       z.literal('grounds').transform(() => 'ground' as const),
       z.literal('warrant'),
       z.literal('backing'),
       z.literal('qualifier'),
       z.literal('rebuttal'),
     ]);
     
     const Body = z.object({  argumentId: z.string().min(5),
  deliberationId: z.string().optional(),
  claimId: z.string().optional(), // if available (for warrant/rebuttal attach)
  slot: SlotZ,
  text: z.string().min(2).max(2000),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { argumentId, deliberationId, claimId, slot, text } = parsed.data;

  // 1) If this is a Warrant and a claim exists → store as ClaimWarrant (canonical)
  if (slot === 'warrant' && claimId) {
    const cw = await prisma.claimWarrant.create({
      data: { claimId, text, createdBy: String(userId) },
    }).catch(() => null);
    if (cw) {
      return NextResponse.json({ ok: true, persisted: 'claimWarrant', id: cw.id });
    }
  }

  // 2) Try MissingPremise (if schema accepts extended premiseType)
  //    If enum rejects (or any failure), fall back to ArgumentAnnotation.
  try {
    const mp = await prisma.missingPremise.create({
      data: {
        deliberationId: deliberationId ?? (await prisma.argument.findUnique({
          where: { id: argumentId },
          select: { deliberationId: true }
        }))?.deliberationId ?? '',
        targetType: 'argument',
        targetId: argumentId,
        proposedById: String(userId),
        text,
        premiseType: slot as any, // may fail if enum doesn't include this value
      },
    });
    return NextResponse.json({ ok: true, persisted: 'missingPremise', id: mp.id });
  } catch {
    // 3) Fallback: ArgumentAnnotation as monological slot
    const aa = await prisma.argumentAnnotation.create({
      data: {
        targetType: 'argument',
        targetId: argumentId,
        type: `monological:${slot}`,
        text,
        source: 'manual',
        offsetStart: 0,
        offsetEnd: Math.min(120, text.length),
      },
    });
    return NextResponse.json({ ok: true, persisted: 'argumentAnnotation', id: aa.id });
  }
}
