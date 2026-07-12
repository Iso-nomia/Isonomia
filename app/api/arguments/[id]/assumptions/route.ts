export const dynamic = "force-dynamic";

// app/api/arguments/[id]/assumptions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

const Body = z.object({
  deliberationId: z.string(),
  items: z.array(z.object({
    assumptionId: z.string(),
    role: z.enum(['premise','warrant','value','context','presumption','exception']).default('premise'),
    weight: z.number().min(0).max(1).optional(),
    metaJson: z.any().optional()
  })).max(100)
});

// --- keep your existing POST exactly as-is ---
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const argId = params.id;
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const { deliberationId, items } = body.data;
  await prisma.assumptionUse.deleteMany({ where: { argumentId: argId } });
  if (items.length) {
    await prisma.assumptionUse.createMany({
      data: items.map(i => ({
        deliberationId,
        argumentId: argId,
        assumptionClaimId: i.assumptionId, // Map assumptionId -> assumptionClaimId
        role: i.role,
        weight: i.weight,
        metaJson: i.metaJson,
      }))
    });
  }
  return NextResponse.json({ ok: true, count: items.length }, NO_STORE);
}

// --- NEW: GET for premise chips + implicit warrant ---
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const a = await prisma.argument.findUnique({
    where: { id },
    select: {
      implicitWarrant: true,
      premises: { select: { claimId: true, isImplicit: true } }
    }
  });
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404, ...NO_STORE });

  const claimIds = a.premises.map(p => p.claimId);
  const claims = claimIds.length
    ? await prisma.claim.findMany({
        where: { id: { in: claimIds } },
        select: { id: true, text: true }
      })
    : [];
  const textById = new Map(claims.map(c => [c.id, c.text ?? '']));

  const premises = a.premises.map(p => ({
    id: p.claimId,
    text: textById.get(p.claimId) ?? '',
    isImplicit: p.isImplicit ?? false
  }));
  const implicitWarrant = a.implicitWarrant
    ? { text: (a.implicitWarrant as any).text ?? String(a.implicitWarrant) }
    : null;

  return NextResponse.json({ ok: true, premises, implicitWarrant }, NO_STORE);
}
