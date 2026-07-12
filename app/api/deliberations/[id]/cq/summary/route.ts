import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

type SummaryItem = {
  claimId: string;
  required: number;
  satisfied: number;
  completeness: number;              // 0..1
  open: { schemeKey: string; cqKey: string }[];
  openByScheme: Record<string, string[]>;
};



function extractCqKeys(raw: any): string[] {
  // Accept either array of {key,text} or array of strings, or object map
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x: any) => (typeof x === 'string' ? x : x?.key)).filter(Boolean);
  }
  return Object.keys(raw);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const url = new URL(req.url);
  const claimIdsParam = url.searchParams.get('claimIds');
  const claimIds = claimIdsParam
    ? [...new Set(claimIdsParam.split(',').map(s => s.trim()).filter(Boolean))]
    : null;

  // 1) Which claims?
  const claimWhere: any = claimIds
    ? { id: { in: claimIds } }
    : { deliberationId };
  const claims = await prisma.claim.findMany({
    where: claimWhere,
    select: { id: true },
  });
  if (!claims.length) return NextResponse.json({ items: [], updatedAt: Date.now() });

  const ids = claims.map(c => c.id);

  // 2) Instances with scheme → CQ list
  const inst = await prisma.schemeInstance.findMany({
    where: { targetType: 'claim', targetId: { in: ids } },
    select: { targetId: true, scheme: { select: { key: true, cq: true } } },
  });
  const requiredByClaim = new Map<string, Record<string, string[]>>();
  for (const i of inst) {
    const skey = i.scheme?.key ?? 'unknown';
    const cqKeys = extractCqKeys(i.scheme?.cq);
    if (!requiredByClaim.has(i.targetId)) requiredByClaim.set(i.targetId, {});
    requiredByClaim.get(i.targetId)![skey] = cqKeys;
  }

  // 3) Status rows (which CQs are satisfied)
  const status = await prisma.cQStatus.findMany({
    where: { targetType: 'claim', targetId: { in: ids } },
    select: { targetId: true, schemeKey: true, cqKey: true, satisfied: true },
  });

  const satisfiedByClaim = new Map<string, Record<string, Set<string>>>();
  for (const s of status) {
    const perClaim = satisfiedByClaim.get(s.targetId) ?? {};
    const set = perClaim[s.schemeKey] ?? new Set<string>();
    if (s.satisfied) set.add(s.cqKey);
    perClaim[s.schemeKey] = set;
    satisfiedByClaim.set(s.targetId, perClaim);
  }

  // 4) Compose summaries
  const items: SummaryItem[] = [];
  for (const cid of ids) {
    const reqMap = requiredByClaim.get(cid) ?? {};
    const satMap = satisfiedByClaim.get(cid) ?? {};
    const open: { schemeKey: string; cqKey: string }[] = [];
    const openByScheme: Record<string, string[]> = {};
    let required = 0;
    let satisfied = 0;

    for (const [schemeKey, reqCqs] of Object.entries(reqMap)) {
      const set = satMap[schemeKey] ?? new Set<string>();
      required += reqCqs.length;
      satisfied += reqCqs.filter(k => set.has(k)).length;
      const missing = reqCqs.filter(k => !set.has(k));
      openByScheme[schemeKey] = missing;
      for (const k of missing) open.push({ schemeKey, cqKey: k });
    }

    const completeness = required ? satisfied / required : 0;
    items.push({ claimId: cid, required, satisfied, completeness, open, openByScheme });
  }

  return NextResponse.json({ items, updatedAt: Date.now() });
}
