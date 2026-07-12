export const dynamic = "force-dynamic";

// app/api/assumptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

/**
 * GET /api/assumptions
 * List assumptions with optional filters
 * 
 * Query params:
 * - deliberationId: Filter by deliberation
 * - argumentId: Filter by argument
 * - status: Filter by status (PROPOSED|ACCEPTED|CHALLENGED|RETRACTED)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deliberationId = searchParams.get("deliberationId");
    const argumentId = searchParams.get("argumentId");
    const status = searchParams.get("status");

    const where: any = {};
    if (deliberationId) where.deliberationId = deliberationId;
    if (argumentId) where.argumentId = argumentId;
    if (status) where.status = status;

    const assumptions = await prisma.assumptionUse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100, // Reasonable limit
    });

    return NextResponse.json({ items: assumptions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching assumptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch assumptions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assumptions
 * Create a new assumption
 * 
 * Body:
 * - deliberationId: string (required)
 * - argumentId: string (required)
 * - assumptionClaimId: string (optional) - Link to existing claim
 * - assumptionText: string (optional) - Freeform text assumption
 * - role: string (default: "premise")
 * - weight: number (optional, 0-1)
 * - confidence: number (optional, 0-1)
 * - metaJson: object (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      deliberationId,
      argumentId,
      assumptionClaimId,
      assumptionText,
      role = "premise",
      weight,
      confidence,
      metaJson,
      content, // Phase A: Allow 'content' as alias for assumptionText
    } = body;

    // Validation
    if (!deliberationId) {
      return NextResponse.json(
        { error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Phase A: Allow standalone assumptions (no argumentId required)
    // They can be linked to arguments later via /api/assumptions/[id]/link

    if (!assumptionClaimId && !assumptionText && !content) {
      return NextResponse.json(
        { error: "Either assumptionClaimId, assumptionText, or content must be provided" },
        { status: 400 }
      );
    }

    // Use content as fallback for assumptionText
    const finalAssumptionText = assumptionText || content;

    // Create the assumption
    const assumption = await prisma.assumptionUse.create({
      data: {
        deliberationId,
        argumentId: argumentId || null, // Phase A: Make argumentId optional
        assumptionClaimId,
        assumptionText: finalAssumptionText,
        role,
        weight,
        confidence,
        metaJson,
        statusChangedBy: user.userId.toString(),
      } as any,
    });

    return NextResponse.json(assumption, { status: 201 });
  } catch (error) {
    console.error("Error creating assumption:", error);
    return NextResponse.json(
      { error: "Failed to create assumption" },
      { status: 500 }
    );
  }
}
