/**
 * PATCH /api/deliberations/[id]/representative-claim
 *
 * Pin (or unpin) a deliberation's representative Claim. Used by the Phase-1
 * topology translator (Stage 2) to mark the deliberation's central thesis
 * once the Claim Analyst output has been ingested.
 *
 * Body:
 *   { claimId: string }   — pin to this Claim. Must belong to the same
 *                           deliberation OR have null deliberationId
 *                           (claims minted via /api/claims with no
 *                           deliberationId are eligible to be pinned).
 *   { claimId: null }     — unpin.
 *
 * Auth: caller must be the deliberation creator.
 *
 * Response: { deliberationId, representativeClaimId }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";

export const dynamic = "force-dynamic";

const Body = z.object({
  claimId: z.string().min(1).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  const authId = await getCurrentUserAuthId();
  if (!userId || !authId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: deliberationId } = await Promise.resolve(params);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { claimId } = parsed.data;

  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, createdById: true },
  });
  if (!deliberation) {
    return NextResponse.json({ error: "Deliberation not found" }, { status: 404 });
  }
  if (deliberation.createdById !== authId && deliberation.createdById !== String(userId)) {
    return NextResponse.json(
      { error: "Forbidden: only the deliberation creator can set the representative claim" },
      { status: 403 }
    );
  }

  // When pinning, validate the Claim exists and belongs to this deliberation
  // (or is unbound, in which case we adopt it into the deliberation).
  if (claimId) {
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, deliberationId: true },
    });
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    if (claim.deliberationId && claim.deliberationId !== deliberationId) {
      return NextResponse.json(
        {
          error:
            "Claim belongs to a different deliberation; mint a new claim or pass an unbound claim",
        },
        { status: 409 }
      );
    }
    // Adopt unbound claim into this deliberation so its edges/citations
    // resolve against the same scope.
    if (!claim.deliberationId) {
      await prisma.claim.update({
        where: { id: claim.id },
        data: { deliberationId },
      });
    }
  }

  const updated = await prisma.deliberation.update({
    where: { id: deliberationId },
    data: { representativeClaimId: claimId },
    select: { id: true, representativeClaimId: true },
  });

  return NextResponse.json({
    deliberationId: updated.id,
    representativeClaimId: updated.representativeClaimId,
  });
}
