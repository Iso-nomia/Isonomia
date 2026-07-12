// app/api/glossary/definitions/[definitionId]/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/glossary/definitions/[definitionId]/vote
 * 
 * Vote on a definition (upvote/downvote/neutral)
 * 
 * Body:
 * - value: number (-1, 0, or +1)
 *   - +1 = upvote
 *   - -1 = downvote
 *   -  0 = neutral/remove vote
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { definitionId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid; // auth_id
    const { definitionId } = params;
    const { value } = await req.json();

    // Validation
    if (typeof value !== "number" || ![-1, 0, 1].includes(value)) {
      return NextResponse.json(
        { error: "Vote value must be -1, 0, or 1" },
        { status: 400 }
      );
    }

    // Check if definition exists
    const definition = await prisma.glossaryDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      return NextResponse.json(
        { error: "Definition not found" },
        { status: 404 }
      );
    }

    // Upsert vote
    const vote = await prisma.glossaryDefinitionVote.upsert({
      where: {
        definitionId_userId: {
          definitionId,
          userId,
        },
      },
      create: {
        definitionId,
        userId,
        value,
      },
      update: {
        value,
        updatedAt: new Date(),
      },
    });

    // Calculate vote totals
    const votes = await prisma.glossaryDefinitionVote.groupBy({
      by: ["value"],
      where: { definitionId },
      _count: true,
    });

    const voteTotals = {
      upvotes: votes.find((v) => v.value === 1)?._count || 0,
      downvotes: votes.find((v) => v.value === -1)?._count || 0,
      neutral: votes.find((v) => v.value === 0)?._count || 0,
    };

    return NextResponse.json({
      vote: {
        value: vote.value,
        createdAt: vote.createdAt,
        updatedAt: vote.updatedAt,
      },
      totals: voteTotals,
    });
  } catch (error) {
    console.error("[POST /api/glossary/definitions/[definitionId]/vote] Error:", error);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/glossary/definitions/[definitionId]/vote
 * 
 * Get current user's vote for this definition
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { definitionId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ vote: null });
    }

    const userId = user.uid; // auth_id
    const { definitionId } = params;

    const vote = await prisma.glossaryDefinitionVote.findUnique({
      where: {
        definitionId_userId: {
          definitionId,
          userId,
        },
      },
    });

    return NextResponse.json({ vote });
  } catch (error) {
    console.error("[GET /api/glossary/definitions/[definitionId]/vote] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vote" },
      { status: 500 }
    );
  }
}
