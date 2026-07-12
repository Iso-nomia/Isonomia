export const dynamic = "force-dynamic";

/**
 * Deliberation-wide stats endpoint for DDS Analysis Panel
 * Returns aggregate counts across ALL designs in a deliberation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deliberationId = searchParams.get("deliberationId");

  if (!deliberationId) {
    return NextResponse.json(
      { error: "deliberationId required" },
      { status: 400 }
    );
  }

  try {
    // Fetch all designs for this deliberation
    const designs = await prisma.ludicDesign.findMany({
      where: { deliberationId },
      select: {
        id: true,
        participantId: true,
        scope: true,
        acts: {
          select: { id: true },
        },
      },
    });

    // Aggregate stats
    const totalDesigns = designs.length;
    const totalActs = designs.reduce((sum, d) => sum + d.acts.length, 0);
    
    // Count unique scopes
    const scopes = new Set(designs.map(d => d.scope).filter(Boolean));
    const totalScopes = scopes.size;

    // Count P and O designs
    const pDesigns = designs.filter(d => d.participantId === "Proponent").length;
    const oDesigns = designs.filter(d => d.participantId === "Opponent").length;

    // Count views
    const viewsCount = await prisma.ludicView.count({
      where: {
        design: { deliberationId },
      },
    });

    // Count chronicles
    const chroniclesCount = await prisma.ludicChronicle.count({
      where: {
        design: { deliberationId },
      },
    });

    // Count strategies
    const strategiesCount = await prisma.ludicStrategy.count({
      where: {
        design: { deliberationId },
      },
    });

    // Count unique loci across all acts
    const allActs = await prisma.ludicAct.findMany({
      where: {
        design: { deliberationId },
      },
      select: { locusId: true },
    });
    const uniqueLoci = new Set(allActs.map(a => a.locusId).filter(Boolean)).size;

    return NextResponse.json({
      ok: true,
      deliberationId,
      stats: {
        designs: totalDesigns,
        pDesigns,
        oDesigns,
        scopes: totalScopes,
        acts: totalActs,
        loci: uniqueLoci,
        views: viewsCount,
        chronicles: chroniclesCount,
        strategies: strategiesCount,
      },
    });
  } catch (error: any) {
    console.error("[dds/stats] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
