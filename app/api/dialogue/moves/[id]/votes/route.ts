export const dynamic = "force-dynamic";

// app/api/dialogue/moves/[id]/votes/route.ts
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

    const dialogueMoveId = params.id;
    const body = await request.json();
    const { voteType } = body;

    if (!["UPVOTE", "DOWNVOTE", "FLAG"].includes(voteType)) {
      return NextResponse.json(
        { error: "Invalid vote type. Must be UPVOTE, DOWNVOTE, or FLAG" },
        { status: 400 }
      );
    }

    // Verify DialogueMove exists
    const move = await prisma.dialogueMove.findUnique({
      where: { id: dialogueMoveId },
      select: { id: true, kind: true },
    });

    if (!move) {
      return NextResponse.json(
        { error: "DialogueMove not found" },
        { status: 404 }
      );
    }

    // Upsert: create or update the user's vote
    const vote = await prisma.responseVote.upsert({
      where: {
        dialogueMoveId_voterId: {
          dialogueMoveId,
          voterId: user.userId.toString(),
        },
      },
      update: {
        voteType,
      },
      create: {
        dialogueMoveId,
        voterId: user.userId.toString(),
        voteType,
      },
    });

    // Get updated counts
    const counts = await getVoteCounts(dialogueMoveId);

    return NextResponse.json(
      {
        vote,
        counts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error voting on dialogue move:", error);
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
    const dialogueMoveId = params.id;

    const counts = await getVoteCounts(dialogueMoveId);

    return NextResponse.json(
      {
        dialogueMoveId,
        total: counts.UPVOTE + counts.DOWNVOTE + counts.FLAG,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dialogueMoveId = params.id;

    // Delete the user's vote if it exists
    await prisma.responseVote.deleteMany({
      where: {
        dialogueMoveId,
        voterId: user.userId.toString(),
      },
    });

    const counts = await getVoteCounts(dialogueMoveId);

    return NextResponse.json(
      {
        message: "Vote removed",
        counts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing vote:", error);
    return NextResponse.json(
      { error: "Failed to remove vote" },
      { status: 500 }
    );
  }
}

// Helper function to get vote counts
async function getVoteCounts(dialogueMoveId: string) {
  const votes = await prisma.responseVote.findMany({
    where: { dialogueMoveId },
    select: { voteType: true },
  });

  const counts = votes.reduce(
    (acc, vote) => {
      acc[vote.voteType] = (acc[vote.voteType] || 0) + 1;
      return acc;
    },
    { UPVOTE: 0, DOWNVOTE: 0, FLAG: 0 } as Record<string, number>
  );

  return counts;
}
