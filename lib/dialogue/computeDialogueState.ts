// lib/dialogue/computeDialogueState.ts
import { prisma } from "@/lib/prismaclient";

export type DialogueState = {
  argumentId: string;
  attackCount: number;
  answeredCount: number; // How many have GROUNDS response
  pendingCount: number; // Unanswered attacks
  state: "strong" | "challenged" | "refuted";
};

/**
 * Compute the dialogue state for an argument by checking which WHY moves
 * have been answered with GROUNDS responses.
 * 
 * Updated to use DialogueMove directly (post-merger with DialogueAction).
 */
export async function computeDialogueState(
  argumentId: string
): Promise<DialogueState> {
  // Get the argument to find its deliberationId
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { deliberationId: true },
  });

  if (!argument) {
    throw new Error(`Argument ${argumentId} not found`);
  }

  // 1. Find all WHY moves targeting this argument
  const whyMoves = await prisma.dialogueMove.findMany({
    where: {
      deliberationId: argument.deliberationId,
      targetType: "argument",
      targetId: argumentId,
      kind: "WHY",
    },
    orderBy: { createdAt: "asc" },
  });

  if (whyMoves.length === 0) {
    return {
      argumentId,
      attackCount: 0,
      answeredCount: 0,
      pendingCount: 0,
      state: "strong",
    };
  }

  // 2. For each WHY, check if there's a GROUNDS response
  let answeredCount = 0;

  for (const why of whyMoves) {
    const cqKey = String(
      (why.payload as any)?.cqId ?? (why.payload as any)?.schemeKey ?? "default"
    );

    // Look for GROUNDS move with matching cqId that came after this WHY
    const grounds = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId: argument.deliberationId,
        targetType: "argument",
        targetId: argumentId,
        kind: "GROUNDS",
        createdAt: { gt: why.createdAt },
        // Check payload for matching cqId
        OR: [
          { payload: { path: ["cqId"], equals: cqKey } },
          { payload: { path: ["schemeKey"], equals: cqKey } },
        ],
      },
    });

    if (grounds) {
      answeredCount++;
    }
  }

  const pendingCount = whyMoves.length - answeredCount;

  // Determine state:
  // - strong: all attacks answered (pendingCount = 0)
  // - challenged: some attacks answered but not all
  // - refuted: no attacks answered (answeredCount = 0)
  let state: "strong" | "challenged" | "refuted";
  if (pendingCount === 0) {
    state = "strong";
  } else if (answeredCount > 0) {
    state = "challenged";
  } else {
    state = "refuted";
  }

  return {
    argumentId,
    attackCount: whyMoves.length,
    answeredCount,
    pendingCount,
    state,
  };
}
