export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

/**
 * POST /api/contraries/create
 * Create an explicit contrary relationship between two claims
 * 
 * Phase D-1: Permissive open model with full provenance tracking
 * Any user can create contraries (no approval needed)
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId().catch(() => null);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      deliberationId,
      claimId,
      contraryId,
      isSymmetric = true,
      reason,
    } = body;

    // Validation 1: Required fields
    if (!deliberationId || !claimId || !contraryId) {
      return NextResponse.json(
        { error: "Missing required fields: deliberationId, claimId, contraryId" },
        { status: 400 }
      );
    }

    // Coerce/validate userId early so a bad session id surfaces as 400, not 500.
    let createdByIdBigInt: bigint;
    try {
      createdByIdBigInt = BigInt(String(userId));
    } catch {
      return NextResponse.json(
        { error: "Invalid session user id" },
        { status: 400 }
      );
    }

    // Validation 2: Self-contrary check
    if (claimId === contraryId) {
      return NextResponse.json(
        { error: "A claim cannot be contrary to itself" },
        { status: 400 }
      );
    }

    // Validation 3: Check if both claims exist and belong to deliberation
    const [claim, contraryClaim] = await Promise.all([
      prisma.claim.findFirst({
        where: {
          id: claimId,
          deliberationId,
        },
      }),
      prisma.claim.findFirst({
        where: {
          id: contraryId,
          deliberationId,
        },
      }),
    ]);

    if (!claim) {
      return NextResponse.json(
        { error: `Claim ${claimId} not found in deliberation` },
        { status: 404 }
      );
    }

    if (!contraryClaim) {
      return NextResponse.json(
        { error: `Claim ${contraryId} not found in deliberation` },
        { status: 404 }
      );
    }

    // Validation 4: Check for duplicate.
    // - Symmetric requests collide with any existing ACTIVE row in either direction.
    // - Asymmetric requests only collide with an ACTIVE row in the same direction
    //   (or with an existing ACTIVE symmetric row in the reverse direction, which
    //   already covers the asymmetric meaning).
    const duplicateOr = isSymmetric
      ? [
          { claimId, contraryId },
          { claimId: contraryId, contraryId: claimId },
        ]
      : [
          { claimId, contraryId },
          { claimId: contraryId, contraryId: claimId, isSymmetric: true },
        ];

    const existingContrary = await prisma.claimContrary.findFirst({
      where: {
        OR: duplicateOr,
        status: "ACTIVE",
      },
    });

    if (existingContrary) {
      return NextResponse.json(
        { error: "Contrary relationship already exists between these claims" },
        { status: 409 }
      );
    }

    // Validation 5: Well-formedness check - cannot target axioms (Phase B)
    // Scoped by deliberation; checks both endpoints when the relation is symmetric
    // (a symmetric contrary effectively targets both claims).
    const axiomTargets = isSymmetric ? [claimId, contraryId] : [contraryId];
    const axiomPremises = await prisma.argumentPremise.findMany({
      where: {
        claimId: { in: axiomTargets },
        isAxiom: true,
        argument: { deliberationId },
      },
      select: { claimId: true },
    });

    if (axiomPremises.length > 0) {
      const offending = Array.from(new Set(axiomPremises.map((p) => p.claimId)));
      return NextResponse.json(
        {
          error: "Cannot create contrary to an axiom",
          details:
            "Well-formedness violation: Contraries cannot target axioms (K_n) within this deliberation.",
          axiomClaimIds: offending,
        },
        { status: 400 }
      );
    }

    // Create the contrary relationship
    const contrary = await prisma.claimContrary.create({
      data: {
        deliberationId,
        claimId,
        contraryId,
        isSymmetric,
        createdById: createdByIdBigInt,
        status: "ACTIVE",
        reason,
      },
      include: {
        claim: {
          select: {
            id: true,
            text: true,
          },
        },
        contrary: {
          select: {
            id: true,
            text: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    console.log(`[Contraries API] Created contrary: ${claimId} <-> ${contraryId} (symmetric: ${isSymmetric})`);

    return NextResponse.json({
      success: true,
      contrary: {
        ...contrary,
        createdById: contrary.createdById.toString(),
        createdBy: {
          ...contrary.createdBy,
          id: contrary.createdBy.id.toString(),
        },
      },
    });
  } catch (error) {
    console.error("[Contraries API] Error creating contrary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
