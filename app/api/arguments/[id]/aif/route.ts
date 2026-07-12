// app/api/arguments/[id]/aif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { TargetType } from '@prisma/client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(String(params.id || '')).trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, ...NO_STORE });

  const a = await prisma.argument.findUnique({
    where: { id },
    select: {
      id: true, deliberationId: true, authorId: true, createdAt: true, text: true, mediaType: true,
      schemeId: true, conclusionClaimId: true, implicitWarrant: true,
      premises: { select: { claimId: true, isImplicit: true } },
      // Phase 4+: Multi-scheme support
      argumentSchemes: {
        include: {
          scheme: {
            select: { id: true, key: true, name: true, slotHints: true }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }]
      },
      // Phase 5: SchemeNet (sequential composition)
      schemeNet: {
        include: {
          steps: {
            include: {
              scheme: {
                select: { id: true, key: true, name: true }
              }
            },
            orderBy: { stepOrder: 'asc' }
          }
        }
      }
    },
  });
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404, ...NO_STORE });

  const [scheme, claims, atkCounts, cqAll, argSupport] = await Promise.all([
    a.schemeId
      ? prisma.argumentScheme.findUnique({
          where: { id: a.schemeId },
          select: { id: true, key: true, name: true, slotHints: true, cqs: { select: { cqKey: true } } },
        })
      : Promise.resolve(null),
    prisma.claim.findMany({
      where: { id: { in: [...(a.conclusionClaimId ? [a.conclusionClaimId] : []), ...a.premises.map(p => p.claimId)] } },
      select: { id: true, text: true },
    }),
    prisma.argumentEdge.groupBy({
      by: ['attackType'],
      where: { toArgumentId: a.id },
      _count: { _all: true },
    }),
    prisma.cQStatus.findMany({
      where: {
        OR: [
          { argumentId: a.id },
          { targetType: 'argument' as TargetType, targetId: a.id },
        ],
      },
      select: { cqKey: true, status: true },
    }),
    // Fetch ArgumentSupport for provenance
    prisma.argumentSupport.findFirst({
      where: { argumentId: a.id },
      select: { provenanceJson: true },
    }),
  ]);

  const textById = new Map(claims.map(c => [c.id, c.text ?? '']));
  const attacks = { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
  for (const g of atkCounts) {
    const k = String(g.attackType || '').toUpperCase() as keyof typeof attacks;
    if (k in attacks) attacks[k] += g._count._all;
  }
  const required = scheme?.cqs?.length ?? 0;
  const satisfied = new Set(cqAll.filter(s => s.status === 'answered' && s.cqKey).map(s => s.cqKey)).size;

  // Extract provenance from ArgumentSupport.provenanceJson
  let provenance: { kind: string; sourceDeliberationId: string; sourceDeliberationName: string; fingerprint?: string } | null = null;
  if (argSupport?.provenanceJson) {
    const prov = argSupport.provenanceJson as any;
    if (prov?.kind === 'import' && prov.fromDeliberationId) {
      // Fetch source deliberation name
      const sourceDelib = await prisma.deliberation.findUnique({
        where: { id: prov.fromDeliberationId },
        select: { title: true },
      });
      if (sourceDelib) {
        provenance = {
          kind: 'import',
          sourceDeliberationId: prov.fromDeliberationId,
          sourceDeliberationName: sourceDelib.title || 'Unknown Deliberation',
          fingerprint: prov.fingerprint,
        };
      }
    }
  }

     // Preference counts (optional, cheap)
  const [prefBy, dispBy] = await Promise.all([
    prisma.preferenceApplication.count({ where: { preferredArgumentId: a.id } }),
    prisma.preferenceApplication.count({ where: { dispreferredArgumentId: a.id } }),
  ]);

  // after computing `attacks` & CQ counts
const prefRows = await prisma.preferenceApplication.findMany({
  where: { OR: [{ preferredArgumentId: a.id }, { dispreferredArgumentId: a.id }] },
  select: { preferredArgumentId: true, dispreferredArgumentId: true },
});
const preferences = {
  preferredBy: prefRows.filter((r: any) => r.preferredArgumentId === a.id).length,
  dispreferredBy: prefRows.filter((r: any) => r.dispreferredArgumentId === a.id).length,
};


  return NextResponse.json({
    ok: true,
    id: a.id,
    deliberationId: a.deliberationId,
    authorId: a.authorId,
    createdAt: a.createdAt.toISOString(),
    text: a.text,
    mediaType: a.mediaType,
    provenance,  // Phase 5A: Cross-deliberation import provenance
    aif: {
      // Legacy single scheme (for backwards compatibility)
      scheme: scheme ? { id: scheme.id, key: scheme.key, name: scheme.name, slotHints: scheme.slotHints ?? null } : null,
      // Phase 4+: All assigned schemes (via ArgumentSchemeInstance)
      schemes: a.argumentSchemes.map(asi => ({
        id: asi.scheme.id,
        key: asi.scheme.key,
        name: asi.scheme.name,
        slotHints: asi.scheme.slotHints ?? null,
        role: asi.role,
        isPrimary: asi.isPrimary,
        confidence: asi.confidence,
        explicitness: asi.explicitness,
      })),
      // Phase 5: SchemeNet (sequential multi-step reasoning)
      schemeNet: a.schemeNet ? {
        id: a.schemeNet.id,
        overallConfidence: a.schemeNet.overallConfidence,
        steps: a.schemeNet.steps.map(step => ({
          id: step.id,
          schemeId: step.schemeId,
          schemeName: step.scheme.name,
          schemeKey: step.scheme.key,
          stepOrder: step.stepOrder,
          label: step.label,
          confidence: step.confidence,
        }))
      } : null,
      conclusion: a.conclusionClaimId ? { id: a.conclusionClaimId, text: textById.get(a.conclusionClaimId) ?? '' } : null,
      premises: a.premises.map(p => ({ id: p.claimId, text: textById.get(p.claimId) ?? '', isImplicit: p.isImplicit ?? false })),
      implicitWarrant: (a.implicitWarrant as any) ?? null,
      attacks,
      cq: { required, satisfied },
    //   preferences: { preferredBy: prefBy, dispreferredBy: dispBy },
    preferences,
    },
  }, NO_STORE);
}
