// app/api/works/[id]/hermeneutic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { z } from 'zod';
import { canEditWorkOrClaimOrphan } from '@/lib/permissions/canEditWork';
export const dynamic = 'force-dynamic';

const FactSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  justification: z.enum(['PERCEPTION','INSTRUMENT','INTERPRETIVE','TESTIMONY']).optional(),
});

const HypothesisSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  notes: z.string().optional(),
  prior: z.number().min(0).max(1).optional(),
});

const PlausibilitySchema = z.object({
  hypothesisId: z.string(),
  score: z.number().min(0).max(1),
  method: z.enum(['bayes','heuristic']).default('heuristic'),
});

const BodySchema = z.object({
  corpusUrl: z.string().url().optional().nullable(),
  facts: z.array(FactSchema).default([]),
  hypotheses: z.array(HypothesisSchema).default([]),
  plausibility: z.array(PlausibilitySchema).default([]),
  selectedIds: z.array(z.string()).default([]),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string }}) {
  const work = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  const herm = await prisma.workHermeneuticProject.findUnique({
    where: { workId: work.id },
  });

  return NextResponse.json({ ok: true, hermeneutic: herm ?? null });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // ✅ author/orphan check
    const perm = await canEditWorkOrClaimOrphan(params.id, String(user.userId));
    if (!perm.ok) {
      const code = perm.reason === 'not-found' ? 404 : 403;
      return NextResponse.json({ error: perm.reason === 'not-found' ? 'Work not found' : 'Forbidden' }, { status: code });
    }

  const work = await prisma.theoryWork.findUnique({ where: { id: params.id } });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });
  if (work.authorId !== String(user.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { corpusUrl, facts, hypotheses, plausibility, selectedIds } = parsed.data;

  const herm = await prisma.workHermeneuticProject.upsert({
    where: { workId: work.id },
    create: {
      workId: work.id,
      corpusUrl: corpusUrl ?? null,
      facts,
      hypotheses,
      plausibility,
      selectedIds,
    },
    update: {
      corpusUrl: corpusUrl ?? null,
      facts,
      hypotheses,
      plausibility,
      selectedIds,
    },
  });

  return NextResponse.json({ ok: true, hermeneutic: herm });
}
