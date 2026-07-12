import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ---------- GET  /api/schemes/instances?targetType=claim&targetId=... ---------- */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetType = url.searchParams.get('targetType') ?? '';
  const targetId   = url.searchParams.get('targetId') ?? '';
  const deliberationId = url.searchParams.get('deliberationId') ?? undefined;

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'targetType and targetId required' }, { status: 400 });
  }
  if (targetType !== 'claim') {
    // If you truly want to support cards, add a branch here
    return NextResponse.json({ error: 'Unsupported targetType. Use "claim".' }, { status: 400 });
  }

  // Optional: ensure target exists (helps fail-fast)
  const exists = await prisma.claim.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  const rows = await prisma.schemeInstance.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      schemeId: true,           // ✅ use schemeId
      data: true,
      createdAt: true,
      createdById: true,
      // Phase 4 — needed by LatentObligationsForTarget to filter open instances
      status: true,
      closedAt: true,
      scheme: {                 // relation to ArgumentScheme
        select: {
          key: true,
          title: true,
          summary: true,
        },
      },
    },
  });

// normalize for FE if you want name instead of title
const instances = rows.map(r => ({
  ...r,
  scheme: { key: r.scheme?.key, name: r.scheme?.title ?? r.scheme?.key, summary: r.scheme?.summary ?? null },
}));
return NextResponse.json({ instances });
}

/* ---------- POST /api/schemes/instances ---------- */
const Body = z.object({
  targetType: z.literal('claim'),
  targetId: z.string().min(1),
  schemeKey: z.string().min(1),
  data: z.any().optional(),
  createdById: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const input = Body.parse(await req.json());

    // 1) validate target
    const claim = await prisma.claim.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    // 2) resolve schemeKey -> schemeId
    const scheme = await prisma.argumentScheme.findUnique({
      where: { key: input.schemeKey },
      select: { id: true, key: true, title: true },
    });
    if (!scheme) return NextResponse.json({ error: 'Unknown scheme' }, { status: 400 });

    // 3) create instance with schemeId
    const inst = await prisma.schemeInstance.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        schemeId: scheme.id,         // ✅ store schemeId, not schemeKey
        data: input.data ?? {},
        createdById: input.createdById,
      },
      select: {
        id: true,
        schemeId: true,
        data: true,
        createdAt: true,
        createdById: true,
        scheme: { select: { key: true, title: true } },
      },
    });

    const out = { ...inst, scheme: { key: inst.scheme?.key, name: inst.scheme?.title ?? inst.scheme?.key } };
    return NextResponse.json({ instance: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}