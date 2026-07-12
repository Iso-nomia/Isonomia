// app/api/works/[id]/pascal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { z } from 'zod';
import { canEditWorkOrClaimOrphan } from '@/lib/permissions/canEditWork';
export const dynamic = 'force-dynamic';

const PropositionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
});

const ActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const UtilitiesSchema = z.record(
  z.string(),                               // actionId
  z.record(z.string(), z.number().finite()) // worldId -> utility
);

const BodySchema = z.object({
  propositions: z.array(PropositionSchema).min(1),
  actions: z.array(ActionSchema).min(1),
  utilities: UtilitiesSchema,
  assumption: z.string().optional().nullable(),
  method: z.enum(['laplace','minimax','regret']).default('laplace'),
  exhaustiveExclusive: z.boolean().optional(),   // PP1
  noTheoreticalEvidence: z.boolean().optional(), // PP3
  orientationCriteria: z.string().optional(),    // limit to orientation-relevant consequences
});

function decide(input: z.infer<typeof BodySchema>) {
  const { propositions, actions, utilities, method } = input;

  const worldIds = propositions.map(p => p.id);
  const actionIds = actions.map(a => a.id);

  const expectedByAction: Record<string, number> = {};

  if (method === 'laplace') {
    const n = worldIds.length;
    for (const a of actionIds) {
      let sum = 0;
      for (const w of worldIds) {
        sum += (utilities[a]?.[w] ?? 0);
      }
      expectedByAction[a] = sum / n;
    }
  } else if (method === 'minimax') {
    for (const a of actionIds) {
      let worst = Number.POSITIVE_INFINITY;
      for (const w of worldIds) {
        const u = utilities[a]?.[w] ?? 0;
        if (u < worst) worst = u;
      }
      expectedByAction[a] = worst;
    }
  } else { // regret (Savage)
    // compute best utility per world
    const bestPerWorld: Record<string, number> = {};
    for (const w of worldIds) {
      let best = Number.NEGATIVE_INFINITY;
      for (const a of actionIds) {
        const u = utilities[a]?.[w] ?? 0;
        if (u > best) best = u;
      }
      bestPerWorld[w] = best;
    }
    // compute average regret per action
    const n = worldIds.length;
    for (const a of actionIds) {
      let regretSum = 0;
      for (const w of worldIds) {
        const u = utilities[a]?.[w] ?? 0;
        regretSum += (bestPerWorld[w] - u);
      }
      expectedByAction[a] = - (regretSum / n); // larger is better (less regret)
    }
  }

  let bestActionId = actionIds[0];
  for (const a of actionIds) {
    if (expectedByAction[a] > expectedByAction[bestActionId]) bestActionId = a;
  }

  return { method, bestActionId, expectedByAction };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string }}) {
  const work = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  const pascal = await prisma.workPascalModel.findUnique({
    where: { workId: work.id },
  });

  return NextResponse.json({ ok: true, pascal: pascal ?? null });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const perm = await canEditWorkOrClaimOrphan(params.id, String(user.userId));
  if (!perm.ok) {
    const code = perm.reason === 'not-found' ? 404 : 403;
    return NextResponse.json({ error: perm.reason === 'not-found' ? 'Work not found' : 'Forbidden' }, { status: code });
  }
  const work = await prisma.theoryWork.findUnique({ where: { id: params.id } });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });
  if (String(work.authorId) !== String(user.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const json = await req.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const decision = decide(parsed.data);

  const pascal = await prisma.workPascalModel.upsert({
    where: { workId: work.id },
    create: {
      workId: work.id,
      propositions: parsed.data.propositions,
      actions: parsed.data.actions,
      utilities: parsed.data.utilities,
      assumption: parsed.data.assumption ?? null,
      decision,
    },
    update: {
      propositions: parsed.data.propositions,
      actions: parsed.data.actions,
      utilities: parsed.data.utilities,
      assumption: parsed.data.assumption ?? null,
      decision,
    },
  });

  return NextResponse.json({ ok: true, pascal, decision });
}
