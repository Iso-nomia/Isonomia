// app/api/deliberations/[id]/aif/route.ts  (sketch)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { validateAifGraph } from 'packages/aif-core/src/invariants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;

  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true, text: true },
  });

  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      id: true, conclusionClaimId: true,
      premises: { select: { claimId: true } },
      scheme: { select: { key: true } },
      implicitWarrant: true,
    },
  });

  const cas = await prisma.conflictApplication.findMany({
    where: { deliberationId },
    select: {
      id: true,
      conflictingArgumentId: true, conflictedArgumentId: true,
      conflictingClaimId: true,    conflictedClaimId: true,
      legacyAttackType: true,      legacyTargetScope: true,
      // (optionally) schemeId for conflict-scheme typing
    },
  });

  const pas = await prisma.preferenceApplication.findMany({
    where: { deliberationId },
    select: {
      id: true, scheme: { select: { key: true } },
      preferredArgumentId: true,   preferredClaimId: true,   preferredSchemeId: true,
      dispreferredArgumentId: true, dispreferredClaimId: true, dispreferredSchemeId: true,
    },
  });

  // AifGraph (for invariants)
  const g = {
    claims: claims.map(c => ({ kind: "I" as const, id: c.id, text: c.text })),
    arguments: args.map(a => ({
      kind: "RA" as const, id: a.id,
      conclusionClaimId: a.conclusionClaimId!,
      premiseClaimIds: a.premises.map(p => p.claimId),
      schemeKey: a.scheme?.key ?? null,
      implicitWarrant: a.implicitWarrant ?? null,
    })),
    attacks: cas.map(x => ({
      kind: "CA" as const, id: x.id,
      fromArgumentId: x.conflictingArgumentId ?? "UNKNOWN",
      toArgumentId: x.conflictedArgumentId ?? undefined,
      targetClaimId: x.conflictedClaimId ?? undefined,
      targetPremiseId: undefined,
      attackType: (x.legacyAttackType ?? (x.conflictedArgumentId ? "UNDERCUTS" : "REBUTS")) as any,
      targetScope: (x.legacyTargetScope ?? (x.conflictedArgumentId ? "inference" : "conclusion")) as any,
      cqKey: null,
    })),
    preferences: pas.map(p => ({
      kind: "PA" as const, id: p.id, schemeKey: p.scheme?.key ?? null,
      preferred: p.preferredArgumentId ? { kind: "RA" as const, id: p.preferredArgumentId } :
                 p.preferredClaimId    ? { kind: "CLAIM" as const, id: p.preferredClaimId } :
                                          { kind: "SCHEME" as const, id: p.preferredSchemeId! },
      dispreferred: p.dispreferredArgumentId ? { kind: "RA" as const, id: p.dispreferredArgumentId } :
                   p.dispreferredClaimId    ? { kind: "CLAIM" as const, id: p.dispreferredClaimId } :
                                              { kind: "SCHEME" as const, id: p.dispreferredSchemeId! },
    })),
  };

  const validation = validateAifGraph(g);

  // Emit JSON-LD (nodes + typed edges RA/CA/PA) — omitted for brevity, but:
  // - Create @graph nodes for I, RA, CA, PA with @type aif:InformationNode | aif:RA | aif:CA | aif:PA
  // - Emit edges with @type aif:Premise, aif:Conclusion, aif:ConflictingElement, aif:ConflictedElement, aif:PreferredElement, aif:DispreferredElement

  return NextResponse.json({ ok:true, validation /*, jsonld*/ }, { headers: { 'Cache-Control':'no-store' } });
}
