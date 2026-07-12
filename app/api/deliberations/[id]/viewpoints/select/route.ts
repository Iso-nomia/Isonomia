export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { selectViewpoints, type SelectionRule } from '@/lib/deepdive/selection';
import { asUserIdString } from '@/lib/auth/normalize';

const Body = z.object({
  k: z.number().min(1).max(7).default(3),
  rule: z.enum(['utilitarian', 'harmonic', 'maxcov']).default('utilitarian'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userIdStr = asUserIdString(userId);
    const deliberationId = params.id;

    // Load deliberation
    const delib = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, rule: true },
    });
    if (!delib) return NextResponse.json({ error: 'Deliberation not found' }, { status: 404 });

    // Parse body
    let parsed = Body.safeParse(await req.json().catch(() => ({})));
    const rule: 'utilitarian'|'harmonic'|'maxcov' =
      (parsed.success ? parsed.data.rule : undefined) ?? delib.rule ?? 'utilitarian';
    const k: number = (parsed.success ? parsed.data.k : 3);

    // --- CACHE SHORT-CIRCUIT (if nothing changed since last selection for same rule/k)
    const [lastEdge, lastApproval] = await Promise.all([
      prisma.argumentEdge.findFirst({
        where: { deliberationId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.argumentApproval.findFirst({
        where: { deliberationId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const lastChangedAt = new Date(
      Math.max(
        lastEdge?.createdAt?.getTime() ?? 0,
        lastApproval?.createdAt?.getTime() ?? 0
      )
    );

    const cached = await prisma.viewpointSelection.findFirst({
      where: { deliberationId, rule, k },
      orderBy: { createdAt: 'desc' },
      include: { viewpointArgs: true },
    });

    if (cached && cached.createdAt > lastChangedAt) {
      // Hydrate views from cached viewpointArgs + arguments
      const argIdsByView: Record<number, string[]> = {};
      for (const va of cached.viewpointArgs) {
        (argIdsByView[va.viewpoint] ??= []).push(va.argumentId);
      }
      const argIds = Object.values(argIdsByView).flat();
      const argRows = await prisma.argument.findMany({
        where: { id: { in: argIds } },
        select: { id: true, text: true, confidence: true },
      });
      const aMap = new Map(argRows.map(a => [a.id, a]));
      const views = Object.entries(argIdsByView)
        .sort((a,b) => Number(a[0]) - Number(b[0]))
        .map(([idx, ids]) => ({
          index: Number(idx),
          arguments: ids.map(id => ({
            id,
            text: aMap.get(id)?.text ?? '',
            confidence: aMap.get(id)?.confidence ?? null,
          })),
        }));

      return NextResponse.json({
        ok: true,
        selection: {
          id: cached.id,
          deliberationId,
          rule: cached.rule as SelectionRule,
          k: cached.k,
          coverageAvg: cached.coverageAvg,
          coverageMin: cached.coverageMin,
          jrSatisfied: cached.jrSatisfied,
          bestPossibleAvg: (cached.explainJson as any)?.bestPossibleAvg ?? undefined,
          conflictsTopPairs: (cached.explainJson as any)?.conflictsTopPairs ?? [],
          views,
          ledgerEventId: undefined, // could fetch most recent event if desired
        },
      });
    }

    // --- COMPUTE FRESH SELECTION
    const [args, edges, approvalsRaw] = await Promise.all([
      prisma.argument.findMany({
        where: { deliberationId },
        select: { id: true, text: true, confidence: true },
      }),
      prisma.argumentEdge.findMany({
        where: { deliberationId },
        select: { fromArgumentId: true, toArgumentId: true, type: true },
      }),
      prisma.argumentApproval.findMany({
        where: { deliberationId },
        select: { userId: true, argumentId: true },
      }),
    ]);

    const nodes = args.map(a => a.id);
    const edgeList = edges.map(e => ({ from: e.fromArgumentId, to: e.toArgumentId, type: e.type })) as any;

    const approvals = new Map<string, Set<string>>();
    for (const a of approvalsRaw) {
      if (!approvals.has(a.userId)) approvals.set(a.userId, new Set());
      approvals.get(a.userId)!.add(a.argumentId);
    }

    const {
      chosen,
      coverageAvg,
      coverageMin,
      jrSatisfied,
      repVector,
      bestPossibleAvg,
      conflictsTopPairs,
    } = selectViewpoints(nodes, edgeList, approvals, { k, rule: rule as SelectionRule });

    // Persist selection
    const selection = await prisma.viewpointSelection.create({
      data: {
        deliberationId,
        rule,
        k,
        coverageAvg,
        coverageMin,
        jrSatisfied,
        createdById: userIdStr,
        explainJson: {
          repVector,
          counts: { users: approvals.size, nodes: nodes.length, edges: edgeList.length },
          bestPossibleAvg,
          conflictsTopPairs,
        },
      },
    });

    // Persist viewpoint arguments
    const vpArgsCreate = chosen.flatMap((set, idx) =>
      [...set].map(argId => ({
        selectionId: selection.id,
        argumentId: argId,
        viewpoint: idx,
      })),
    );
    if (vpArgsCreate.length) {
      await prisma.viewpointArgument.createMany({ data: vpArgsCreate, skipDuplicates: true });
    }

    // Create amplification event once and capture id
    const reasonText =
      rule === 'utilitarian'
        ? 'Chosen to maximize average coverage of approvals'
        : rule === 'harmonic'
        ? 'Chosen to balance average and fairness (harmonic weights)'
        : 'Chosen to maximize the count of fully represented voters (JR-oriented)';

    const evt = await prisma.amplificationEvent.create({
      data: {
        eventType: 'deliberation_viewpoint_selected',
        createdById: userIdStr,
        reason: reasonText,
        deliberationId,
        viewpointSelectionId: selection.id,
        payload: { deliberationId, selectionId: selection.id, k, coverageAvg, coverageMin, jrSatisfied, rule },
      },
    });

    // Hydrate response
    const mapText = new Map(args.map(a => [a.id, { text: a.text, confidence: a.confidence }]));
    const views = chosen.map((set, idx) => ({
      index: idx,
      arguments: [...set].map(id => ({ id, ...mapText.get(id)! })),
    }));

    return NextResponse.json({
      ok: true,
      selection: {
        id: selection.id,
        deliberationId,
        rule,
        k,
        coverageAvg,
        coverageMin,
        jrSatisfied,
        bestPossibleAvg,
        conflictsTopPairs,
        views,
        ledgerEventId: evt.id, // ✅ for WhyThis "View ledger"
      },
    });
  } catch (e: any) {
    console.error('[viewpoints/select] failed', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
