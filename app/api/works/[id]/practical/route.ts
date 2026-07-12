// app/api/works/[id]/practical/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
// Use the working import you confirmed:
import { getUserFromCookies } from '@/lib/serverutils';

export const dynamic = 'force-dynamic';

const criterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0),
  kind: z.enum(['prudential', 'moral']).optional(),
});

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  desc: z.string().optional(),
});

const scoresSchema = z.record(
  z.string(), // optionId
  z.record(z.string(), z.number().finite()) // { [criterionId]: number }
);

const bodySchema = z.object({
  purpose: z.string().default(''),
  criteria: z.array(criterionSchema).min(1, 'Add at least one criterion'),
  options: z.array(optionSchema).min(1, 'Add at least one option'),
  scores: scoresSchema,
});

type Crit = z.infer<typeof criterionSchema>;
type Opt = z.infer<typeof optionSchema>;
type Scores = z.infer<typeof scoresSchema>;

function computeMcda(criteria: Crit[], options: Opt[], scores: Scores) {
  // 1) normalize weights
  const sumW = criteria.reduce((s, c) => s + (c.weight ?? 0), 0) || 1;
  const wNorm: Record<string, number> = {};
  for (const c of criteria) wNorm[c.id] = (c.weight ?? 0) / sumW;

  // 2) min–max normalize scores per criterion (higher = better)
  const totals: Record<string, number> = {};
  const perCriterionScale: Record<string, { min: number; max: number }> = {};
  for (const c of criteria) {
    let min = Infinity, max = -Infinity;
    for (const o of options) {
      const v = scores[o.id]?.[c.id] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    perCriterionScale[c.id] = { min, max };
  }

  for (const o of options) {
    let total = 0;
    for (const c of criteria) {
      const raw = scores[o.id]?.[c.id] ?? 0;
      const { min, max } = perCriterionScale[c.id];
      const norm = max > min ? (raw - min) / (max - min) : 0; // flat criterion ⇒ 0
      total += (wNorm[c.id] ?? 0) * norm;
    }
    totals[o.id] = total;
  }

  // 3) pick best
  let bestOptionId: string | null = null;
  let bestVal = -Infinity;
  for (const o of options) {
    const t = totals[o.id] ?? 0;
    if (t > bestVal) { bestVal = t; bestOptionId = o.id; }
  }

  return {
    bestOptionId,
    totals,
    weightsNormalized: wNorm,
    perCriterionScale,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const workId = params.id;
  const work = await prisma.theoryWork.findUnique({ where: { id: workId } });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  const pj = await prisma.workPracticalJustification.findUnique({
    where: { workId },
  });

  return NextResponse.json({
    ok: true,
    workId,
    justification: pj ?? {
      workId,
      purpose: '',
      criteria: [],
      options: [],
      scores: {},
      result: {},
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const workId = params.id;
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const work = await prisma.theoryWork.findUnique({ where: { id: workId } });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  // Only the author can update its practical justification
  if (String(work.authorId) !== String(user.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { purpose, criteria, options, scores } = parsed.data;

  const result = computeMcda(criteria, options, scores);

  const adequacy = {
  completeness: Object.keys(scores).length === options.length,
  dominance: (() => {
    // naive Pareto dominance check
    const critIds = criteria.map(c => c.id);
    const totalsArr = options.map(o => ({ id: o.id, t: result.totals[o.id] ?? 0 }));
    const best = totalsArr.sort((a,b)=>b.t-a.t)[0];
    const strictlyBetterThanAll = totalsArr.every(x => best.id === x.id || best.t > x.t);
    return strictlyBetterThanAll ? 'strong' : 'none';
  })(),
  robustness: { sensitivityNotes: '' },
};

  const saved = await prisma.workPracticalJustification.upsert({
    where: { workId },
    create: {
      workId,
      purpose,
      criteria,
      options,
      scores,
      result,
      adequacy,
    },
    update: {
      purpose,
      criteria,
      options,
      scores,
      result,
      adequacy,
    },
  });

  return NextResponse.json({ ok: true, workId, justification: saved });
}
