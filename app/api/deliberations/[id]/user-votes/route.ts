export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/user-votes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/deliberations/[id]/user-votes?userId=X
 * 
 * Fetches all ResponseVote records for a user in a deliberation.
 * Returns the vote along with information about what was voted on.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    // Fetch all ResponseVote records for this user with related data
    const votes = await prisma.responseVote.findMany({
      where: {
        voterId: userId,
        dialogueMove: {
          deliberationId: deliberationId,
        },
      },
      include: {
        dialogueMove: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform votes with target information
    const transformedVotes = await Promise.all(
      votes.map(async (vote) => {
        let targetText = "";
        let targetType = "unknown";

        // Get target text based on move's target
        if (vote.dialogueMove.targetId) {
          // Try to find the target claim
          const claim = await prisma.claim.findUnique({
            where: { id: vote.dialogueMove.targetId },
            select: { text: true },
          });

          if (claim) {
            targetText = claim.text;
            targetType = "claim";
          } else {
            // Try argument
            const arg = await prisma.argument.findUnique({
              where: { id: vote.dialogueMove.targetId },
              include: { claim: { select: { text: true } } },
            });

            if (arg) {
              targetText = arg.claim?.text || "Argument";
              targetType = "argument";
            }
          }
        }

        // Extract text from payload if it's a GROUNDS move
        const payload = vote.dialogueMove.payload as Record<string, unknown> | null;
        const moveText = payload?.text as string || "";

        // Use actorId for display (could be enhanced with user lookup if needed)
        const actorName = vote.dialogueMove.actorId?.slice(0, 8) || "Unknown";

        return {
          id: vote.id,
          voteType: vote.voteType,
          createdAt: vote.createdAt.toISOString(),
          dialogueMoveId: vote.dialogueMoveId,
          dialogueMoveKind: vote.dialogueMove.kind,
          dialogueMoveText: moveText,
          actorName,
          targetType,
          targetText: targetText.length > 100 ? targetText.slice(0, 100) + "..." : targetText,
        };
      })
    );

    return NextResponse.json({
      votes: transformedVotes,
      total: transformedVotes.length,
      byType: {
        UPVOTE: transformedVotes.filter((v) => v.voteType === "UPVOTE").length,
        DOWNVOTE: transformedVotes.filter((v) => v.voteType === "DOWNVOTE").length,
        FLAG: transformedVotes.filter((v) => v.voteType === "FLAG").length,
      },
    });
  } catch (error) {
    console.error("Error fetching user votes:", error);
    return NextResponse.json(
      { error: "Failed to fetch user votes" },
      { status: 500 }
    );
  }
}
