export const dynamic = "force-dynamic";

// app/api/dialogue-actions/[id]/votes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dialogueActionId = params.id;
    const body = await request.json();
    const { voteType } = body;

    if (!["UPVOTE", "DOWNVOTE", "FLAG"].includes(voteType)) {
      return NextResponse.json(
        { error: "Invalid vote type" },
        { status: 400 }
      );
    }

    // Upsert: create or update the user's vote
    const vote = await prisma.responseVote.upsert({
      where: {
        dialogueMoveId_voterId: {
          dialogueMoveId: dialogueActionId,
          voterId: user.userId.toString(),
        },
      },
      update: {
        voteType,
      },
      create: {
        dialogueMoveId: dialogueActionId,
        voterId: user.userId.toString(),
        voteType,
      },
    });

    return NextResponse.json(vote, { status: 200 });
  } catch (error) {
    console.error("Error voting on dialogue action:", error);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dialogueActionId = params.id;

    // Get vote counts grouped by type
    const votes = await prisma.responseVote.findMany({
      where: { dialogueMoveId: dialogueActionId },
      select: { voteType: true },
    });

    const counts = votes.reduce(
      (acc: Record<string, number>, vote: { voteType: string }) => {
        acc[vote.voteType] = (acc[vote.voteType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json(
      {
        dialogueActionId,
        total: votes.length,
        counts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching vote counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch votes" },
      { status: 500 }
    );
  }
}
