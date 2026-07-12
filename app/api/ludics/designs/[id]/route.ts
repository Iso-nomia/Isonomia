export const dynamic = "force-dynamic";

/**
 * Ludic Design by ID API
 * GET /api/ludics/designs/[id]
 * 
 * Fetches a single ludic design by its ID with all related data.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Design ID is required" },
        { status: 400 }
      );
    }

    const design = await prisma.ludicDesign.findUnique({
      where: { id },
      include: {
        acts: {
          include: { locus: true },
          orderBy: { orderInDesign: "asc" },
        },
        // Include related DDS data if available
        positiveDisputes: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        negativeDisputes: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        strategies: true,
        correspondences: true,
      },
    });

    if (!design) {
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Compute summary stats
    const stats = {
      actCount: design.acts.length,
      properActCount: design.acts.filter((a) => a.kind === "PROPER").length,
      daimonActCount: design.acts.filter((a) => a.kind === "DAIMON").length,
      disputeCount: design.positiveDisputes.length + design.negativeDisputes.length,
      strategyCount: design.strategies.length,
      hasCorrespondence: design.correspondences.length > 0,
    };

    // Extract unique loci paths
    const lociPaths = [
      ...new Set(
        design.acts
          .map((a) => a.locus?.path)
          .filter((p): p is string => Boolean(p))
      ),
    ];

    return NextResponse.json({
      ok: true,
      design,
      stats,
      lociPaths,
    });
  } catch (error: any) {
    console.error("[Ludic Design GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Design ID is required" },
        { status: 400 }
      );
    }

    // Only allow updating certain fields
    const allowedFields = ["participantId", "scope", "scopeType", "scopeMetadata", "extJson"];
    const updateData: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const design = await prisma.ludicDesign.update({
      where: { id },
      data: updateData,
      include: {
        acts: {
          include: { locus: true },
          orderBy: { orderInDesign: "asc" },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      design,
    });
  } catch (error: any) {
    console.error("[Ludic Design PATCH Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Design ID is required" },
        { status: 400 }
      );
    }

    // Check if design exists
    const existing = await prisma.ludicDesign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Delete design (cascades to acts, disputes, etc. via Prisma schema)
    await prisma.ludicDesign.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      deleted: true,
      designId: id,
    });
  } catch (error: any) {
    console.error("[Ludic Design DELETE Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
