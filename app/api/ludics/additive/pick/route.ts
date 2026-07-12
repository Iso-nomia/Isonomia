export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

const zBody = z.object({
  dialogueId: z.string(),
  posDesignId: z.string().optional(), // hints only; we’ll resolve
  negDesignId: z.string().optional(),
  parentPath: z.string(),             // e.g. "0.3"
  childSuffix: z.string(),            // e.g. "1"
});

async function resolveDesigns(dialogueId: string, posHint?: string, negHint?: string) {
  // Try hints, then fall back to current designs for the dialogue
  const [posH, negH] = await Promise.all([
    posHint ? prisma.ludicDesign.findUnique({ where: { id: posHint } }) : null,
    negHint ? prisma.ludicDesign.findUnique({ where: { id: negHint } }) : null,
  ]);

  const [posOk, negOk] = [
    posH && posH.deliberationId === dialogueId ? posH : null,
    negH && negH.deliberationId === dialogueId ? negH : null,
  ];

  if (posOk && negOk) return { posUse: posOk, negUse: negOk, refreshed: false };

  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: dialogueId },
    orderBy: [{ participantId: 'asc' }, { id: 'asc' }],
    select: { id: true, participantId: true, deliberationId: true },
  });

  const posUse = posOk ?? (designs.find(d => d.participantId === 'Proponent') ?? designs[0] ?? null);
  const negUse = negOk ?? (designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0] ?? null);
  return { posUse, negUse, refreshed: true };
}

export async function POST(req: NextRequest) {
  const parsed = zBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { dialogueId, posDesignId, negDesignId, parentPath, childSuffix } = parsed.data;

  // 1) Resolve to live designs for this dialogue (handles stale IDs after compile)
  const { posUse, negUse } = await resolveDesigns(dialogueId, posDesignId, negDesignId);
  if (!posUse || !negUse) {
    return NextResponse.json({ ok:false, error:'NO_SUCH_DESIGN' }, { status: 409 });
  }

  // 2) Read last trace for the resolved pair, merge usedAdditive
  const last = await prisma.ludicTrace.findFirst({
    where: { deliberationId: dialogueId, posDesignId: posUse.id, negDesignId: negUse.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, steps: true, extJson: true },
  });

  const oldUsed = (last?.extJson as any)?.usedAdditive ?? {};
  const usedAdditive = { ...oldUsed, [parentPath]: childSuffix };

  // 3) Update the last trace if present; otherwise create a new placeholder trace
  try {
    let traceRow;
    if (last) {
      // Use updateMany to avoid Prisma error logging when trace deleted by concurrent compile
      const updated = await prisma.ludicTrace.updateMany({
        where: { id: last.id },
        data: { extJson: { ...(last.extJson as any), usedAdditive } },
      });
      
      if (updated.count > 0) {
        // Return the existing trace info
        return NextResponse.json({
          ok: true,
          traceId: last.id,
          usedDesigns: { posDesignId: posUse.id, negDesignId: negUse.id },
          usedAdditive,
        });
      }
      
      // Trace was deleted, create new one
      traceRow = await prisma.ludicTrace.create({
        data: {
          deliberationId: dialogueId,
          posDesignId: posUse.id,
          negDesignId: negUse.id,
          status: 'ONGOING',
          steps: [],
          extJson: { usedAdditive },
        },
      });
    } else {
      traceRow = await prisma.ludicTrace.create({
        data: {
          deliberationId: dialogueId,
          posDesignId: posUse.id,
          negDesignId: negUse.id,
          status: 'ONGOING',
          steps: [],
          extJson: { usedAdditive },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      traceId: traceRow.id,
      usedDesigns: { posDesignId: posUse.id, negDesignId: negUse.id },
      usedAdditive,
    });
  } catch (e: any) {
    // Rare race: designs recompiled between resolve + write → retry once with a fresh resolve
    const { posUse: p2, negUse: n2 } = await resolveDesigns(dialogueId);
    const traceRow = await prisma.ludicTrace.create({
      data: {
        deliberationId: dialogueId,
        posDesignId: p2!.id,
        negDesignId: n2!.id,
        status: last?.status ?? 'ONGOING',
        steps: last?.steps ?? [],
        extJson: { usedAdditive },
      },
    });
    return NextResponse.json({
      ok: true,
      traceId: traceRow.id,
      usedDesigns: { posDesignId: p2!.id, negDesignId: n2!.id },
      usedAdditive,
      retried: true,
    });
  }
}
