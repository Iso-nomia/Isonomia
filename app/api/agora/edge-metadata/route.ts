import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

const Query = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(["xref", "overlap", "stack_ref", "imports", "shared_author"]),
});

export const dynamic = "force-dynamic";

/**
 * GET /api/agora/edge-metadata
 * 
 * Fetch detailed metadata for a Plexus edge between two deliberations.
 * Used for enhanced edge tooltips in Plexus visualization.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const parsed = Query.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    kind: searchParams.get("kind"),
  });
  
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  
  const { from, to, kind } = parsed.data;
  
  try {
    if (kind === "imports") {
      // Fetch argument imports between deliberations
      const imports = await prisma.argumentImport.findMany({
        where: {
          fromDeliberationId: from,
          toDeliberationId: to,
        },
        include: {
          toArgument: {
            select: { text: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      
      // Fetch claim texts separately
      const claimIds = imports.map((i) => i.toClaimId).filter(Boolean) as string[];
      const claims = await prisma.claim.findMany({
        where: { id: { in: claimIds } },
        select: { id: true, text: true },
      });
      const claimMap = new Map(claims.map((c) => [c.id, c.text]));
      
      return NextResponse.json({
        ok: true,
        kind: "imports",
        count: imports.length,
        items: imports.map((imp) => ({
          fingerprint: imp.fingerprint,
          argumentText: imp.toArgument?.text || "",
          claimText: imp.toClaimId ? claimMap.get(imp.toClaimId) || "" : "",
          createdAt: imp.toArgument?.createdAt,
        })),
      });
    } else if (kind === "shared_author") {
      // Fetch shared author details
      const edge = await prisma.sharedAuthorRoomEdge.findUnique({
        where: {
          fromId_toId: { fromId: from, toId: to } as any,
        },
        select: { strength: true },
      });
      
      if (!edge) {
        return NextResponse.json({
          ok: true,
          kind: "shared_author",
          count: 0,
          items: [],
        });
      }
      
      // Find which authors are shared
      const fromAuthors = await prisma.argument.findMany({
        where: { deliberationId: from },
        select: { authorId: true },
        distinct: ["authorId"],
      });
      
      const toAuthors = await prisma.argument.findMany({
        where: { deliberationId: to },
        select: { authorId: true },
        distinct: ["authorId"],
      });
      
      const fromSet = new Set(fromAuthors.map((a) => a.authorId));
      const toSet = new Set(toAuthors.map((a) => a.authorId));
      const sharedAuthorIds = [...fromSet].filter((id) => toSet.has(id) && id !== "system");
      
      return NextResponse.json({
        ok: true,
        kind: "shared_author",
        count: sharedAuthorIds.length,
        strength: edge.strength,
        items: sharedAuthorIds.slice(0, 5).map((authorId) => ({
          authorId,
        })),
      });
    } else if (kind === "overlap") {
      // Fetch overlapping canonical claims
      const fromClaims = await prisma.claim.findMany({
        where: {
          deliberationId: from,
          NOT: { canonicalClaimId: null },
        },
        select: { id: true, text: true, canonicalClaimId: true },
      });
      
      const toClaims = await prisma.claim.findMany({
        where: {
          deliberationId: to,
          NOT: { canonicalClaimId: null },
        },
        select: { id: true, text: true, canonicalClaimId: true },
      });
      
      const toCanonicalMap = new Map(toClaims.map((c) => [c.canonicalClaimId!, c]));
      const overlaps = fromClaims
        .filter((fc) => toCanonicalMap.has(fc.canonicalClaimId!))
        .map((fc) => ({
          fromClaimText: fc.text,
          toClaimText: toCanonicalMap.get(fc.canonicalClaimId!)!.text,
          canonicalId: fc.canonicalClaimId,
        }))
        .slice(0, 5);
      
      return NextResponse.json({
        ok: true,
        kind: "overlap",
        count: overlaps.length,
        items: overlaps,
      });
    } else if (kind === "stack_ref") {
      // Fetch stack references
      const refs = await prisma.stackReference.findMany({
        where: {
          fromDeliberationId: from,
          toDeliberationId: to,
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      
      return NextResponse.json({
        ok: true,
        kind: "stack_ref",
        count: refs.length,
        items: refs.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
        })),
      });
    } else if (kind === "xref") {
      // Fetch cross-references
      const xrefs = await (prisma as any).xRef.findMany({
        where: {
          fromId: from,
          toId: to,
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).catch(() => []);
      
      return NextResponse.json({
        ok: true,
        kind: "xref",
        count: xrefs.length,
        items: xrefs.map((x: any) => ({
          id: x.id,
          createdAt: x.createdAt,
        })),
      });
    }
    
    return NextResponse.json({
      ok: false,
      error: "Unsupported edge kind",
    }, { status: 400 });
  } catch (error) {
    console.error("[edge-metadata] Error:", error);
    return NextResponse.json({
      ok: false,
      error: "Failed to fetch edge metadata",
    }, { status: 500 });
  }
}
