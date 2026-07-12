export const dynamic = "force-dynamic";

// app/api/monological/telemetry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

type Mix = { grounds:number; qualifiers:number; rebuttals:number; warrants:number; backing:number };

function empty(): Mix { return { grounds:0, qualifiers:0, rebuttals:0, warrants:0, backing:0 }; }

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const url = new URL(req.url);
  const argumentId     = url.searchParams.get('argumentId') || undefined;
  const deliberationId = url.searchParams.get('deliberationId') || undefined;
  if (!argumentId && !deliberationId) {
    return NextResponse.json({ ok:false, error:'argumentId or deliberationId required' }, { status:400 });
  }

  // 1) Collect the argument set
  const args = await prisma.argument.findMany({
    where: argumentId ? { id: argumentId } : { deliberationId: deliberationId!, /* exclude implicit children from accept-flow */ isImplicit: false },
    select: { id:true, deliberationId:true, quantifier:true, modality:true }
  });
  if (args.length === 0) return NextResponse.json({ ok:true, perArgument:{}, totals: empty(), saturation:{ likely:false } });

  const ids = args.map(a => a.id);

  // 2) Pull monological “missing premises” for these arguments
  const mps = await prisma.missingPremise.findMany({
    where: { targetType:'argument', targetId: { in: ids } },
    select: { targetId:true, premiseType:true }
  });

  // 3) Reduce → per-argument mix
  const perArgument: Record<string, Mix> = {};
  for (const a of args) perArgument[a.id] = empty();

  for (const r of mps) {
    const k = r.targetId;
    const t = (r.premiseType || '').toLowerCase();
    if (!perArgument[k]) continue;
    if (t === 'ground' || t === 'grounds') perArgument[k].grounds++;
    else if (t === 'qualifier')           perArgument[k].qualifiers++;
    else if (t === 'rebuttal')            perArgument[k].rebuttals++;
    else if (t === 'warrant')             perArgument[k].warrants++;
    else if (t === 'backing')             perArgument[k].backing++;
  }

  // 4) Count persistent qualifier on the argument itself (quantifier/modality)
  for (const a of args) {
    if (a.quantifier != null) perArgument[a.id].qualifiers++;
    if (a.modality   != null) perArgument[a.id].qualifiers++;
  }

  // 5) Aggregate
  const totals = Object.values(perArgument).reduce((acc, m) => ({
    grounds:   acc.grounds   + m.grounds,
    qualifiers:acc.qualifiers+ m.qualifiers,
    rebuttals: acc.rebuttals + m.rebuttals,
    warrants:  acc.warrants  + m.warrants,
    backing:   acc.backing   + m.backing
  }), empty());

  // 6) Saturation heuristic (qualifiers pile up; few rebuttals)
  //    Inspired by Murungi & Hirschheim’s diagnostic of mix patterns to spot stuck discourse,
  //    e.g., many qualifiers/grounds with scarce rebuttals. :contentReference[oaicite:1]{index=1}
  const Q = totals.qualifiers, R = totals.rebuttals, G = totals.grounds;
  const likely =
    (Q >= 5 && R <= 1) ||            // clear build-up with almost no rebuttal
    (Q >= 3 && R === 0 && Q >= G);   // qualifiers dominate, zero rebuttals

  const saturation = { likely, rationale: { Q, R, G } };

  return NextResponse.json({ ok:true, perArgument, totals, saturation });
}
