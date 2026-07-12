// app/api/deliberations/[id]/negation-map/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ============================================================================
// GET: Retrieve all negation mappings for a deliberation
// ============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    const maps = await prisma.negationMap.findMany({
      where: { deliberationId },
      include: {
        claim: { select: { id: true, text: true } },
        negatedClaim: { select: { id: true, text: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      deliberationId,
      maps: maps.map((m) => ({
        id: m.id,
        claimId: m.claimId,
        claimText: m.claim.text,
        negatedClaimId: m.negatedClaimId,
        negatedClaimText: m.negatedClaim.text,
        confidence: m.confidence,
        createdAt: m.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[negation-map] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create or update negation mapping
// ============================================================================
const CreateSchema = z.object({
  claimId: z.string(),
  negatedClaimId: z.string(),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  symmetric: z.boolean().optional().default(true), // Also create reverse mapping
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const body = await req.json();
    const { claimId, negatedClaimId, confidence, symmetric } =
      CreateSchema.parse(body);

    // Validate claims exist and belong to this deliberation
    const claims = await prisma.claim.findMany({
      where: {
        id: { in: [claimId, negatedClaimId] },
        deliberationId,
      },
    });

    if (claims.length !== 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "Both claims must exist in this deliberation",
        },
        { status: 400 }
      );
    }

    if (claimId === negatedClaimId) {
      return NextResponse.json(
        { ok: false, error: "Claim cannot negate itself" },
        { status: 400 }
      );
    }

    // Create or update negation mapping
    const map = await prisma.negationMap.upsert({
      where: {
        claimId_negatedClaimId_deliberationId: {
          claimId,
          negatedClaimId,
          deliberationId,
        },
      },
      update: { confidence },
      create: {
        claimId,
        negatedClaimId,
        deliberationId,
        confidence,
      },
      include: {
        claim: { select: { text: true } },
        negatedClaim: { select: { text: true } },
      },
    });

    // Optionally create symmetric mapping
    let reverseMap = null;
    if (symmetric) {
      reverseMap = await prisma.negationMap.upsert({
        where: {
          claimId_negatedClaimId_deliberationId: {
            claimId: negatedClaimId,
            negatedClaimId: claimId,
            deliberationId,
          },
        },
        update: { confidence },
        create: {
          claimId: negatedClaimId,
          negatedClaimId: claimId,
          deliberationId,
          confidence,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      map: {
        id: map.id,
        claimId: map.claimId,
        claimText: map.claim.text,
        negatedClaimId: map.negatedClaimId,
        negatedClaimText: map.negatedClaim.text,
        confidence: map.confidence,
      },
      reverseMap: reverseMap
        ? {
            id: reverseMap.id,
            claimId: reverseMap.claimId,
            negatedClaimId: reverseMap.negatedClaimId,
            confidence: reverseMap.confidence,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[negation-map] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Remove negation mapping
// ============================================================================
const DeleteSchema = z.object({
  id: z.string().optional(),
  claimId: z.string().optional(),
  negatedClaimId: z.string().optional(),
  symmetric: z.boolean().optional().default(true), // Also delete reverse mapping
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const body = await req.json();
    const { id, claimId, negatedClaimId, symmetric } = DeleteSchema.parse(body);

    if (!id && (!claimId || !negatedClaimId)) {
      return NextResponse.json(
        { ok: false, error: "Must provide either id or claimId+negatedClaimId" },
        { status: 400 }
      );
    }

    let deleted = 0;

    if (id) {
      // Delete by ID
      const map = await prisma.negationMap.findUnique({ where: { id } });
      if (!map || map.deliberationId !== deliberationId) {
        return NextResponse.json(
          { ok: false, error: "Negation map not found" },
          { status: 404 }
        );
      }

      await prisma.negationMap.delete({ where: { id } });
      deleted++;

      // Delete symmetric mapping if requested
      if (symmetric) {
        const reverseDeleted = await prisma.negationMap.deleteMany({
          where: {
            claimId: map.negatedClaimId,
            negatedClaimId: map.claimId,
            deliberationId,
          },
        });
        deleted += reverseDeleted.count;
      }
    } else if (claimId && negatedClaimId) {
      // Delete by claim pair
      const result = await prisma.negationMap.deleteMany({
        where: { claimId, negatedClaimId, deliberationId },
      });
      deleted += result.count;

      // Delete symmetric mapping if requested
      if (symmetric) {
        const reverseDeleted = await prisma.negationMap.deleteMany({
          where: {
            claimId: negatedClaimId,
            negatedClaimId: claimId,
            deliberationId,
          },
        });
        deleted += reverseDeleted.count;
      }
    }

    return NextResponse.json({
      ok: true,
      deleted,
    });
  } catch (error: any) {
    console.error("[negation-map] DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
