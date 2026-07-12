export const dynamic = "force-dynamic";

// app/api/cqs/responses/[id]/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const VoteSchema = z.object({
  value: z.enum(["1", "-1"]).transform((v) => parseInt(v)), // 1 for upvote, -1 for downvote
});

// Simple in-memory vote tracking (could move to Redis or DB)
// Structure: Map<responseId, Set<userId>>
const upvoteTracker = new Map<string, Set<string>>();
const downvoteTracker = new Map<string, Set<string>>();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const responseId = params.id;

  const parsed = VoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { value } = parsed.data;

  // Check if response exists
  const response = await prisma.cQResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      cqStatusId: true,
      upvotes: true,
      downvotes: true,
      contributorId: true,
    },
  });

  if (!response) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  // Can't vote on your own response
  if (response.contributorId === String(userId)) {
    return NextResponse.json(
      { error: "Cannot vote on your own response" },
      { status: 403 }
    );
  }

  // Initialize trackers if needed
  if (!upvoteTracker.has(responseId)) {
    upvoteTracker.set(responseId, new Set());
  }
  if (!downvoteTracker.has(responseId)) {
    downvoteTracker.set(responseId, new Set());
  }

  const userUpvotes = upvoteTracker.get(responseId)!;
  const userDownvotes = downvoteTracker.get(responseId)!;

  const userIdStr = String(userId);
  let upvoteDelta = 0;
  let downvoteDelta = 0;

  if (value === 1) {
    // Upvote
    if (userUpvotes.has(userIdStr)) {
      // Already upvoted - remove upvote (toggle off)
      userUpvotes.delete(userIdStr);
      upvoteDelta = -1;
    } else {
      // Add upvote
      userUpvotes.add(userIdStr);
      upvoteDelta = 1;
      // Remove downvote if exists
      if (userDownvotes.has(userIdStr)) {
        userDownvotes.delete(userIdStr);
        downvoteDelta = -1;
      }
    }
  } else {
    // Downvote
    if (userDownvotes.has(userIdStr)) {
      // Already downvoted - remove downvote (toggle off)
      userDownvotes.delete(userIdStr);
      downvoteDelta = -1;
    } else {
      // Add downvote
      userDownvotes.add(userIdStr);
      downvoteDelta = 1;
      // Remove upvote if exists
      if (userUpvotes.has(userIdStr)) {
        userUpvotes.delete(userIdStr);
        upvoteDelta = -1;
      }
    }
  }

  // Update vote counts in database
  const updated = await prisma.cQResponse.update({
    where: { id: responseId },
    data: {
      upvotes: { increment: upvoteDelta },
      downvotes: { increment: downvoteDelta },
    },
    select: {
      upvotes: true,
      downvotes: true,
    },
  });

  return NextResponse.json({
    ok: true,
    upvotes: updated.upvotes,
    downvotes: updated.downvotes,
    netVotes: updated.upvotes - updated.downvotes,
    userVote: userUpvotes.has(userIdStr) ? 1 : userDownvotes.has(userIdStr) ? -1 : 0,
  });
}

// GET endpoint to check user's current vote
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ userVote: 0 });
  }

  const responseId = params.id;
  const userIdStr = String(userId);

  const userUpvotes = upvoteTracker.get(responseId);
  const userDownvotes = downvoteTracker.get(responseId);

  const userVote = userUpvotes?.has(userIdStr)
    ? 1
    : userDownvotes?.has(userIdStr)
    ? -1
    : 0;

  return NextResponse.json({ userVote });
}
