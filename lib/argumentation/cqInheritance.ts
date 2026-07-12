/**
 * lib/argumentation/cqInheritance.ts
 * 
 * Phase 6B: Server-only CQ Inheritance Logic
 * 
 * This module handles database operations for CQ inheritance.
 * Separated from cqGeneration.ts to keep that file client-safe.
 * 
 * IMPORTANT: This file uses Prisma and must only be imported in server-side code
 * (API routes, Server Components, server actions).
 */

import { prisma } from "@/lib/prismaclient";

/**
 * Phase 6B: Fetch CQs from parent schemes recursively
 * 
 * SERVER-ONLY: Uses Prisma client to traverse scheme hierarchy.
 * 
 * Traverses the scheme hierarchy upward, collecting CQs from all ancestor schemes.
 * This implements the "family resemblance" principle: child schemes inherit
 * the critical questions of their parents (e.g., Slippery Slope inherits from
 * Negative Consequences, which inherits from Practical Reasoning).
 * 
 * @param schemeId - ID of the scheme to fetch CQs for
 * @param includeParentCQs - Whether to include inherited CQs (default: true)
 * @returns Array of CQs (own + inherited from ancestors)
 */
export async function getCQsWithInheritance(
  schemeId: string,
  includeParentCQs: boolean = true
): Promise<Array<{ cqKey: string; text: string; attackType: string; targetScope: string; inherited: boolean; fromScheme: string }>> {
  const scheme = await prisma.argumentScheme.findUnique({
    where: { id: schemeId },
    select: {
      id: true,
      key: true,
      name: true,
      parentSchemeId: true,
      cqs: {
        select: {
          cqKey: true,
          text: true,
          attackType: true,
          targetScope: true,
        },
      },
    },
  });

  if (!scheme) {
    throw new Error(`Scheme ${schemeId} not found`);
  }

  const allCQs: Array<{
    cqKey: string;
    text: string;
    attackType: string;
    targetScope: string;
    inherited: boolean;
    fromScheme: string;
  }> = [];

  // Add this scheme's own CQs
  for (const cq of scheme.cqs) {
    allCQs.push({
      cqKey: cq.cqKey ?? "",
      text: cq.text,
      attackType: cq.attackType ?? "",
      targetScope: cq.targetScope ?? "",
      inherited: false,
      fromScheme: scheme.name || scheme.key,
    });
  }

  // Recursively fetch parent CQs (Phase 3 step 13: inheritance is now
  // unconditional when a parent edge exists; the per-row opt-out is retired).
  if (includeParentCQs && scheme.parentSchemeId) {
    const parentCQs = await getCQsWithInheritance(
      scheme.parentSchemeId,
      true // Keep recursing up the hierarchy
    );

    for (const parentCQ of parentCQs) {
      // Mark as inherited if not already in child's CQs
      const isDuplicate = allCQs.some((cq) => cq.cqKey === parentCQ.cqKey);
      if (!isDuplicate) {
        allCQs.push({
          ...parentCQ,
          inherited: true, // Mark as inherited from ancestor
        });
      }
    }
  }

  return allCQs;
}

/**
 * Phase 6B: Generate complete CQ set with inheritance
 * 
 * SERVER-ONLY: Uses Prisma client.
 * 
 * Combines taxonomy-based generation with database CQs and inherited parent CQs.
 * This is the primary function to use for displaying CQs in the UI.
 * 
 * @param schemeId - ID of the scheme
 * @param includeInherited - Whether to include parent CQs (default: true)
 * @param maxCQs - Maximum total CQs to return (default: 15)
 * @returns Complete CQ set with inheritance metadata
 */
export async function generateCompleteCQSetWithInheritance(
  schemeId: string,
  includeInherited: boolean = true,
  maxCQs: number = 15
): Promise<Array<{
  cqKey: string;
  text: string;
  attackType: string;
  targetScope: string;
  inherited: boolean;
  fromScheme: string;
  priority: number;
}>> {
  const cqsWithInheritance = await getCQsWithInheritance(
    schemeId,
    includeInherited
  );

  // Assign priority scores (own CQs > inherited CQs)
  const priorityMap: Record<string, number> = {
    UNDERMINES: 3, // Premise attacks
    UNDERCUTS: 2,  // Inference attacks
    REBUTS: 1,     // Conclusion attacks
  };

  const prioritized = cqsWithInheritance.map((cq) => ({
    ...cq,
    priority: cq.inherited
      ? priorityMap[cq.attackType] * 0.8 // Inherited CQs slightly lower priority
      : priorityMap[cq.attackType],
  }));

  // Sort: own CQs first (by attack type), then inherited CQs (by attack type)
  prioritized.sort((a, b) => {
    // First sort by inherited status
    if (a.inherited !== b.inherited) {
      return a.inherited ? 1 : -1;
    }
    // Then by priority score
    const diff = b.priority - a.priority;
    if (diff !== 0) return diff;
    // Tie-breaker: alphabetical
    return a.cqKey.localeCompare(b.cqKey);
  });

  return prioritized.slice(0, maxCQs);
}
