/**
 * Embed Validation Utilities
 * 
 * Phase 1.4 of Stacks Improvement Roadmap
 * 
 * Prevents circular references when embedding stacks within stacks.
 */

import { prisma } from "@/lib/prismaclient";

/**
 * Check if embedding `childStackId` in `parentStackId` would create a cycle.
 * Returns true if cycle detected (embed should be blocked).
 * 
 * Uses BFS to traverse all stacks that the child contains (directly or transitively)
 * and checks if any of them is the parent stack.
 */
export async function wouldCreateCycle(
  parentStackId: string,
  childStackId: string
): Promise<boolean> {
  // Case 1: Direct self-embed
  if (parentStackId === childStackId) {
    return true;
  }

  // Case 2: Child already contains parent (directly or transitively)
  const visited = new Set<string>();
  const queue = [childStackId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Check if this stack embeds the parent
    const embeds = await prisma.stackItem.findMany({
      where: { stackId: current, kind: "stack_embed" },
      select: { embedStackId: true },
    });

    for (const embed of embeds) {
      if (embed.embedStackId === parentStackId) {
        return true; // Cycle detected
      }
      if (embed.embedStackId) {
        queue.push(embed.embedStackId);
      }
    }
  }

  return false;
}

/**
 * Check if a stack is already embedded in another stack.
 */
export async function isStackEmbedded(
  parentStackId: string,
  embedStackId: string
): Promise<boolean> {
  const existing = await prisma.stackItem.findFirst({
    where: {
      stackId: parentStackId,
      embedStackId,
      kind: "stack_embed",
    },
  });
  return !!existing;
}
