export const dynamic = "force-dynamic";

// app/api/theory-works/[id]/checklist/route.ts
// ✅ CORRECTED VERSION - Uses proper lowercase field names from updated schema

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { headers } from 'next/headers';

const Params = z.object({ id: z.string().min(3) });

type FilledStat = { required: number; filled: number; open: string[] };

function fieldStat<T extends Record<string, any>>(obj?: T | null, req: (keyof T)[] = []): FilledStat {
  if (!obj) return { required: req.length, filled: 0, open: req.map(String) };
  const open: string[] = [];
  let filled = 0;
  for (const k of req) {
    const v = (obj as any)[k as string];
    const ok =
      Array.isArray(v) ? v.length > 0 :
      typeof v === 'string' ? v.trim().length > 0 :
      v !== null && v !== undefined;
    if (ok) filled++; else open.push(String(k));
  }
  return { required: req.length, filled, open };
}

async function countEvidenceForClaims(claimIds: string[]) {
  const [ev, cit] = await Promise.all([
    prisma.claimEvidence?.count?.({ where: { claimId: { in: claimIds } } }).catch(() => 0),
    prisma.claimCitation?.count?.({ where: { claimId: { in: claimIds } } }).catch(() => 0),
  ]);
  return (Number(ev) || 0) + (Number(cit) || 0);
}

function getBaseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;
  return (fromEnv || (host ? `${proto}://${host}` : '')).replace(/\/$/, '');
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const { id } = Params.parse(ctx.params);

  // ✅ FIXED: Use lowercase field names matching the updated schema
  const work = await prisma.theoryWork.findUnique({
    where: { id },
    include: {
      dnStructure: true,        // was: WorkDNStructure
      ihTheses: true,           // was: WorkIHTheses
      tcTheses: true,           // was: WorkTCTheses
      opTheses: true,           // was: WorkOPTheses
      claims: true,             // was: relatedClaims
      dnProject: true,          // ✅ Added - you might need these too
      ihProject: true,          // ✅ Added
      tcProject: true,          // ✅ Added
      opProject: true,          // ✅ Added
    }
  });
  
  if (!work) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const dnSlots = ['explanandum','nomological','ceterisParibus'] as const;
  const ihSlots = ['structure','function','objectivity'] as const;
  const tcSlots = ['instrumentFunction','explanation','applications'] as const;
  const opSlots = ['unrecognizability','alternatives'] as const;

  // ✅ FIXED: Access the correctly named fields
  const dn = fieldStat(work.dnStructure as any, dnSlots as any);
  const ih = fieldStat(work.ihTheses as any, ihSlots as any);
  const tc = fieldStat(work.tcTheses as any, tcSlots as any);
  const op = fieldStat(work.opTheses as any, opSlots as any);

  // ✅ FIXED: Use 'claims' instead of 'relatedClaims'
  const claimIds = (work.claims ?? []).map(c => c.claimId);
  const origin = getBaseUrl();

  const cqSummaries = await Promise.all(
    claimIds.map(async (cid) => {
      try {
        const r = await fetch(`${origin}/api/claims/${cid}/cq/summary`, { cache: 'no-store' });
        if (!r.ok) return null;
        return r.json() as Promise<{
          schemes: Array<{schemeKey:string; required:number; satisfied:number; open:string[]}>;
          required:number; satisfied:number; completeness:number;
        }>;
      } catch {
        return null;
      }
    })
  );

  const cqRequired = cqSummaries.reduce((a,s)=> a + (s?.required ?? 0), 0);
  const cqSatisfied = cqSummaries.reduce((a,s)=> a + (s?.satisfied ?? 0), 0);
  const schemesMap = new Map<string, { required: number; satisfied: number; open: string[] }>();
  
  for (const s of cqSummaries.filter(Boolean) as NonNullable<typeof cqSummaries[number]>[]) {
    for (const row of s.schemes) {
      const acc = schemesMap.get(row.schemeKey) ?? { required: 0, satisfied: 0, open: [] as string[] };
      acc.required += row.required; 
      acc.satisfied += row.satisfied; 
      acc.open.push(...row.open);
      schemesMap.set(row.schemeKey, acc);
    }
  }
  
  const openByScheme = [...schemesMap.entries()].map(([schemeKey, v]) => ({ 
    schemeKey, 
    required: v.required, 
    satisfied: v.satisfied, 
    open: v.open 
  }));

  const evidenceCount = claimIds.length ? await countEvidenceForClaims(claimIds) : 0;

  // Optional dialogue peek
  let dialogue: any = { hasClosableLoci: false, legalMoves: [] as any[] };
  try {
    if (claimIds[0]) {
      const r = await fetch(`${origin}/api/dialogue/legal-moves?targetType=claim&targetId=${claimIds[0]}`, { cache: 'no-store' });
      if (r.ok) {
        const { moves, closable } = await r.json();
        dialogue = {
          hasClosableLoci: !!closable,
          legalMoves: (moves ?? []).slice(0, 4).map((m: any) => ({ 
            kind: m.kind, 
            force: m.force, 
            relevance: m.relevance 
          }))
        };
      }
    }
  } catch {}

  const cqCompleteness = cqRequired ? cqSatisfied / cqRequired : 0;
  const minCQ = Number(process.env.CQ_MIN_COMPLETENESS ?? '0.6');

  const typeStat =
    work.theoryType === 'DN' ? dn :
    work.theoryType === 'IH' ? ih :
    work.theoryType === 'TC' ? tc :
    work.theoryType === 'OP' ? op : { required: 0, filled: 0, open: [] };

  const publishable = typeStat.required > 0
    && typeStat.required === typeStat.filled
    && cqCompleteness >= minCQ;

  return NextResponse.json({
    work: { 
      id: work.id, 
      title: work.title, 
      theoryType: work.theoryType, 
      status: work.status 
    },
    dn, ih, tc, op,
    theses: { dn: dnSlots, ih: ihSlots, tc: tcSlots, op: opSlots },
    claims: {
      count: claimIds.length,
      // ✅ FIXED: Use 'claims' instead of 'relatedClaims'
      byRole: (work.claims ?? []).reduce((acc, c) => {
        acc[c.role] = (acc[c.role] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      cq: { 
        required: cqRequired, 
        satisfied: cqSatisfied, 
        openByScheme, 
        completeness: cqCompleteness 
      },
      evidence: { count: evidenceCount }
    },
    dialogue,
    publishable
  });
}