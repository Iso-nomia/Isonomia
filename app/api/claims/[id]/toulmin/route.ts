// app/api/claims/[id]/toulmin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { ClaimAttackType, ClaimEdgeType } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// function iconForScheme(key?: string | null): string | undefined {
//   if (!key) return undefined;
//   switch (key) {
//     case 'expert_opinion':     return '/icons/scheme-expert-opinion.svg';
//     case 'good_consequences':  return '/icons/scheme-consequences.svg';
//     case 'analogy':            return '/icons/scheme-analogy.svg';
//     default:                   return '/icons/scheme-generic.svg';
//   }
// }

function iconForScheme(key?: string | null): string | undefined {
  if (!key) return undefined;
  switch (key) {
    case 'expert_opinion':    return 'eo';
    case 'good_consequences': return 'gc';
    case 'analogy':           return 'an';
    default:                  return '***';
  }
}

function mode<T extends string>(arr: (T | null | undefined)[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of arr) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: T | undefined = undefined;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = params.id;

  // 1) Claim
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, text: true, deliberationId: true },
  });
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  // 2) Inbound edges (grounds/rebuttals/undercuts)
  const inbound = await prisma.claimEdge.findMany({
    where: { toClaimId: claimId },
    select: {
      id: true,
      type: true,            // enum ClaimEdgeType
      attackType: true,      // enum ClaimAttackType | null
      targetScope: true,     // 'premise' | 'inference' | 'conclusion' | null
      from: { select: { id: true, text: true } },
    },
  });

  const grounds = inbound
    .filter(e => e.type === ClaimEdgeType.supports)
    .map(e => ({ id: e.from.id, text: e.from.text }));

  const rebuttals = inbound
    .filter(e => e.type === ClaimEdgeType.rebuts)
    .map(e => ({
      id: e.from.id,
      text: e.from.text,
      scope: (e.targetScope ?? (e.attackType === ClaimAttackType.REBUTS ? 'conclusion' : null)) as
        | 'premise' | 'inference' | 'conclusion' | null,
    }));

  const undercuts = inbound
    .filter(e => e.attackType === ClaimAttackType.UNDERCUTS)
    .map(e => ({ id: e.from.id, text: e.from.text }));

  // 3) Backing (schemes + citations/evidence)
const schemes = await prisma.schemeInstance.findMany({
    where: { targetType: 'claim', targetId: claimId },
    select: {
      scheme: { select: { key: true, title: true, summary: true } },
    },
  });
  const schemeCounts: Record<string, { key: string; name?: string | null; icon?: string; count: number }> = {};
  for (const s of schemes) {
    const key = s.scheme?.key ?? 'generic';
    const name = (s.scheme as any)?.title ?? key; // normalize
    schemeCounts[key] ??= { key, name, icon: iconForScheme(key), count: 0 };
    schemeCounts[key].count += 1;
  }
  

  const [citationCount, evidenceCount] = await Promise.all([
    prisma.claimCitation.count({ where: { claimId } }),
    prisma.evidenceLink.count({ where: { targetKind: "claim", targetId: claimId } }),
  ]);

  // 4) Qualifier (from arguments promoted to this claim)
const argRows = await prisma.argument.findMany({
  where: { claimId },
  select: { quantifier: true, modality: true, confidence: true },
});
const qualifier = {
  quantifier: mode<( 'SOME' | 'MANY' | 'MOST' | 'ALL')>(argRows.map(a => a.quantifier as any)),
  modality: mode<('COULD' | 'LIKELY' | 'NECESSARY')>(argRows.map(a => a.modality as any)),
  confidenceAvg:
    argRows.length ? (argRows.reduce((s, a) => s + (a.confidence ?? 0), 0) / argRows.length) : null,
};

// 5) Warrant text
const warrantRow = await prisma.claimWarrant.findUnique({
  where: { claimId },
  select: { text: true },
});
const warrant = warrantRow?.text ?? null;


  return NextResponse.json({
    claim: { id: claim.id, text: claim.text },
    grounds,
    rebuttals,
    undercuts,
    backing: {
      schemes: Object.values(schemeCounts),     // [{key,name,icon,count}]
      citations: citationCount,
      evidence: evidenceCount,
    },
    qualifier,
    warrant, // 👈


  });
}
