// lib/cqs/permissions.ts
// Permission helpers for CQ multi-layer response system

import { prisma } from "@/lib/prismaclient";

export interface CQPermissionContext {
  userId: string; // auth_id of current user
  claimAuthorId: string;
  roomId?: string | null;
  deliberationId?: string | null;
}

/**
 * Check if user has moderator role in the room
 */
export async function isRoomModerator(userId: string, roomId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: {
      userId: BigInt(userId),
      role: { in: ["moderator", "admin"] },
    },
  });
  return !!role;
}

/**
 * Check if user is a participant in the deliberation/room
 */
export async function isDeliberationParticipant(
  userId: string,
  deliberationId: string
): Promise<boolean> {
  // Check if user has any claims, arguments, or dialogue moves in this deliberation
  const [hasClaims, hasArguments, hasMoves] = await Promise.all([
    prisma.claim.findFirst({
      where: { deliberationId, createdById: userId },
      select: { id: true },
    }),
    prisma.argument.findFirst({
      where: { deliberationId, authorId: userId },
      select: { id: true },
    }),
    prisma.dialogueMove.findFirst({
      where: { deliberationId, actorId: userId },
      select: { id: true },
    }),
  ]);

  return !!(hasClaims || hasArguments || hasMoves);
}

/**
 * Check if room is public (anyone can view/submit)
 */
export async function isRoomPublic(roomId: string): Promise<boolean> {
  const room = await prisma.agoraRoom.findUnique({
    where: { id: roomId },
    select: { visibility: true },
  });
  return room?.visibility === "public";
}

/**
 * Get full permission context for a CQ
 */
export async function getCQPermissions(
  userId: string,
  cqStatusId: string
): Promise<{
  canViewCQ: boolean;
  canViewPendingResponses: boolean;
  canSubmitResponse: boolean;
  canEditResponse: boolean;
  canWithdrawResponse: boolean;
  canVoteOnResponse: boolean;
  canEndorseResponse: boolean;
  canApproveResponse: boolean;
  canRejectResponse: boolean;
  canSetCanonical: boolean;
  canRequestClarification: boolean;
}> {
  // Get CQ status with claim info
  const cqStatus = await prisma.cQStatus.findUnique({
    where: { id: cqStatusId },
    select: {
      targetId: true,
      targetType: true,
      roomId: true,
      createdById: true,
    },
  });

  if (!cqStatus) {
    // CQ doesn't exist - deny all
    return {
      canViewCQ: false,
      canViewPendingResponses: false,
      canSubmitResponse: false,
      canEditResponse: false,
      canWithdrawResponse: false,
      canVoteOnResponse: false,
      canEndorseResponse: false,
      canApproveResponse: false,
      canRejectResponse: false,
      canSetCanonical: false,
      canRequestClarification: false,
    };
  }

  // Get claim/argument to find the author
  let claimAuthorId: string | null = null;
  let deliberationId: string | null = null;

  if (cqStatus.targetType === "claim") {
    const claim = await prisma.claim.findUnique({
      where: { id: cqStatus.targetId },
      select: { createdById: true, deliberationId: true },
    });
    claimAuthorId = claim?.createdById || null;
    deliberationId = claim?.deliberationId || null;
  } else if (cqStatus.targetType === "argument") {
    const argument = await prisma.argument.findUnique({
      where: { id: cqStatus.targetId },
      select: { authorId: true, deliberationId: true },
    });
    claimAuthorId = argument?.authorId || null;
    deliberationId = argument?.deliberationId || null;
  }

  const isAuthor = claimAuthorId === userId;
  const isModerator = cqStatus.roomId ? await isRoomModerator(userId, cqStatus.roomId) : false;
  const isPublic = cqStatus.roomId ? await isRoomPublic(cqStatus.roomId) : true;
  const isParticipant = deliberationId
    ? await isDeliberationParticipant(userId, deliberationId)
    : false;

  // Permission rules (based on design doc)
  return {
    canViewCQ: true, // Everyone can view CQs
    canViewPendingResponses: isAuthor || isModerator, // Only author/mod see pending
    canSubmitResponse: isPublic || isParticipant, // Public or participants
    canEditResponse: true, // Can edit own response before review (checked elsewhere)
    canWithdrawResponse: true, // Can withdraw own response (checked elsewhere)
    canVoteOnResponse: true, // Anyone authenticated can vote
    canEndorseResponse: isParticipant || isAuthor || isModerator, // Participants+
    canApproveResponse: isAuthor || isModerator, // Author or moderator
    canRejectResponse: isAuthor || isModerator, // Author or moderator
    canSetCanonical: isAuthor || isModerator, // Author or moderator
    canRequestClarification: true, // Anyone can request clarification
  };
}

/**
 * Check if user can approve/reject a specific response
 */
export async function canModerateResponse(
  userId: string,
  responseId: string
): Promise<boolean> {
  const response = await prisma.cQResponse.findUnique({
    where: { id: responseId },
    include: {
      cqStatus: {
        select: {
          targetId: true,
          targetType: true,
          roomId: true,
        },
      },
    },
  });

  if (!response) return false;

  // Get claim/argument author
  let claimAuthorId: string | null = null;

  if (response.cqStatus.targetType === "claim") {
    const claim = await prisma.claim.findUnique({
      where: { id: response.cqStatus.targetId },
      select: { createdById: true },
    });
    claimAuthorId = claim?.createdById || null;
  } else if (response.cqStatus.targetType === "argument") {
    const argument = await prisma.argument.findUnique({
      where: { id: response.cqStatus.targetId },
      select: { authorId: true },
    });
    claimAuthorId = argument?.authorId || null;
  }

  const isAuthor = claimAuthorId === userId;
  const isModerator = response.cqStatus.roomId
    ? await isRoomModerator(userId, response.cqStatus.roomId)
    : false;

  return isAuthor || isModerator;
}

/**
 * Check if user is the contributor of a response
 */
export async function isResponseContributor(
  userId: string,
  responseId: string
): Promise<boolean> {
  const response = await prisma.cQResponse.findUnique({
    where: { id: responseId },
    select: { contributorId: true },
  });

  return response?.contributorId === userId;
}
