export const dynamic = "force-dynamic";

// app/api/claims/[id]/ensure-schemes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

const ParamsSchema = z.object({ id: z.string().min(1) });

// Generic claim-level schemes for when claims don't have argument-based schemes
const GENERIC_CLAIM_SCHEMES = [
  {
    key: "claim_relevance",
    title: "Claim Relevance",
    cq: [
      {
        key: "relevant_to_topic",
        text: "Is this claim relevant to the deliberation topic?",
      },
      {
        key: "addresses_issue",
        text: "Does this claim directly address the issue being discussed?",
      },
    ],
  },
  {
    key: "claim_clarity",
    title: "Claim Clarity",
    cq: [
      {
        key: "clearly_stated",
        text: "Is the claim clearly and unambiguously stated?",
      },
      {
        key: "terms_defined",
        text: "Are all key terms in the claim properly defined?",
      },
    ],
  },
  {
    key: "claim_truth",
    title: "Claim Truth",
    cq: [
      {
        key: "factually_accurate",
        text: "Is the claim factually accurate?",
      },
      {
        key: "evidence_exists",
        text: "Is there evidence to support this claim?",
      },
      {
        key: "expert_consensus",
        text: "Is there expert consensus on this claim?",
      },
    ],
  },
];

/**
 * POST /api/claims/[id]/ensure-schemes
 * 
 * Ensures that a claim has at least one scheme attached so CQs can be asked.
 * If the claim has no schemes, attaches generic claim-level schemes.
 * 
 * This is called automatically when opening the CQ modal for a claim.
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const parsed = ParamsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const claimId = parsed.data.id;

  try {
    // Check if claim exists
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, deliberationId: true },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Check if claim already has schemes
    const existingSchemes = await prisma.schemeInstance.findMany({
      where: { targetType: "claim", targetId: claimId },
      select: { id: true, scheme: { select: { key: true } } },
    });

    if (existingSchemes.length > 0) {
      // Already has schemes, nothing to do
      return NextResponse.json({
        ok: true,
        message: "Claim already has schemes",
        schemeCount: existingSchemes.length,
        schemes: existingSchemes.map((s) => s.scheme?.key).filter(Boolean),
      });
    }

    // No schemes exist - attach generic claim schemes
    const attachedSchemes: string[] = [];

    for (const genericScheme of GENERIC_CLAIM_SCHEMES) {
      // Find or create the ArgumentScheme
      let scheme = await prisma.argumentScheme.findUnique({
        where: { key: genericScheme.key },
        select: { id: true, key: true },
      });

      if (!scheme) {
        // Create the generic scheme if it doesn't exist yet
        scheme = await prisma.argumentScheme.create({
          data: {
            key: genericScheme.key,
            title: genericScheme.title,
            summary: `Generic claim-level critical questions for ${genericScheme.title.toLowerCase()}`,
            cq: genericScheme.cq,
            description: `Critical questions to evaluate ${genericScheme.title.toLowerCase()} at the claim level`,
          },
          select: { id: true, key: true },
        });
      }

      // Create SchemeInstance linking claim to scheme (need to get current user ID)
      const userId = req.headers.get("x-user-id") || "system";

      await prisma.schemeInstance.create({
        data: {
          targetType: "claim",
          targetId: claimId,
          schemeId: scheme.id,
          data: {}, // Empty data for generic schemes
          createdById: userId,
        },
      });

      attachedSchemes.push(scheme.key);
    }

    return NextResponse.json({
      ok: true,
      message: "Generic claim schemes attached",
      schemeCount: attachedSchemes.length,
      schemes: attachedSchemes,
    });
  } catch (error: any) {
    console.error("[ensure-schemes] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to ensure schemes" },
      { status: 500 }
    );
  }
}
