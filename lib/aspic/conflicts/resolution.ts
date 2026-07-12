/**
 * Conflict resolution strategies and application logic
 */

import { prisma } from "@/lib/prismaclient";
import { Prisma } from "@prisma/client";
import type { PreferenceConflict, PreferenceInCycle } from "./detection";
import { detectConflicts } from "./detection";

export interface ResolutionStrategy {
  type: "remove_weakest" | "remove_oldest" | "user_selection" | "vote_based";
  label: string;
  description: string;
  toRemove: string[]; // PA IDs to remove
  recommendation?: "recommended" | "neutral" | "not_recommended";
}

/**
 * Suggest resolution strategies for a conflict
 */
export function suggestResolutionStrategies(
  conflict: PreferenceConflict
): ResolutionStrategy[] {
  const strategies: ResolutionStrategy[] = [];
  const prefs = conflict.preferences;

  if (prefs.length === 0) {
    return strategies;
  }

  // Strategy 1: Remove weakest preference (by weight)
  const sortedByWeight = [...prefs].sort((a, b) => a.weight - b.weight);
  const weakest = sortedByWeight[0];
  
  strategies.push({
    type: "remove_weakest",
    label: "Remove Weakest Preference",
    description: `Remove preference with lowest confidence (weight=${weakest.weight.toFixed(2)})`,
    toRemove: [weakest.id],
    recommendation: sortedByWeight[0].weight < (sortedByWeight[1]?.weight ?? 1.0) ? "recommended" : "neutral",
  });

  // Strategy 2: Remove oldest preference (temporal ordering)
  const sortedByDate = [...prefs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const oldest = sortedByDate[0];
  
  strategies.push({
    type: "remove_oldest",
    label: "Keep Most Recent",
    description: `Remove oldest preference (created ${oldest.createdAt.toLocaleDateString()})`,
    toRemove: [oldest.id],
    recommendation: "neutral",
  });

  // Strategy 3: Vote-based (if multiple users)
  const userGroups = new Map<string, PreferenceInCycle[]>();
  for (const pref of prefs) {
    if (!userGroups.has(pref.createdBy)) {
      userGroups.set(pref.createdBy, []);
    }
    userGroups.get(pref.createdBy)!.push(pref);
  }

  if (userGroups.size > 1) {
    // Find user with fewest preferences in cycle (minority opinion)
    let minCount = Infinity;
    let minorityUser = "";
    for (const [userId, userPrefs] of userGroups) {
      if (userPrefs.length < minCount) {
        minCount = userPrefs.length;
        minorityUser = userId;
      }
    }

    const minorityPrefs = userGroups.get(minorityUser) ?? [];
    strategies.push({
      type: "vote_based",
      label: "Remove Minority Opinion",
      description: `Remove preferences from user with fewest contributions (${minCount} preference${minCount > 1 ? "s" : ""})`,
      toRemove: minorityPrefs.map(p => p.id),
      recommendation: "neutral",
    });
  }

  // Strategy 4: Manual selection (always available)
  strategies.push({
    type: "user_selection",
    label: "Manual Selection",
    description: "Choose which preference(s) to remove manually",
    toRemove: [], // User will select
    recommendation: "neutral",
  });

  return strategies;
}

/**
 * Apply resolution strategy to conflict
 */
export async function applyResolution(
  strategy: ResolutionStrategy,
  userId: string,
  deliberationId: string
): Promise<{ success: boolean; removed: number; newCycles: number }> {
  if (strategy.toRemove.length === 0) {
    return {
      success: false,
      removed: 0,
      newCycles: await detectConflicts(deliberationId).then(c => c.length),
    };
  }

  // Soft delete: mark preferences as resolved
  await prisma.preferenceApplication.updateMany({
    where: { id: { in: strategy.toRemove } },
    data: {
      conflictStatus: "resolved",
      conflictResolution: {
        strategy: strategy.type,
        label: strategy.label,
        description: strategy.description,
        resolvedAt: new Date().toISOString(),
        resolvedBy: userId,
      } as any,
      conflictResolvedAt: new Date(),
      conflictResolvedBy: userId,
    },
  });

  // Re-check for remaining conflicts
  const remainingConflicts = await detectConflicts(deliberationId);

  return {
    success: true,
    removed: strategy.toRemove.length,
    newCycles: remainingConflicts.length,
  };
}

/**
 * Undo resolution (restore resolved preferences)
 */
export async function undoResolution(
  paIds: string[]
): Promise<{ restored: number }> {
  if (paIds.length === 0) {
    return { restored: 0 };
  }

  await prisma.preferenceApplication.updateMany({
    where: { id: { in: paIds } },
    data: {
      conflictStatus: "none",
      conflictResolution: Prisma.JsonNull,
      conflictResolvedAt: null,
      conflictResolvedBy: null,
    },
  });

  return { restored: paIds.length };
}

/**
 * Get resolution history for deliberation
 */
export async function getResolutionHistory(
  deliberationId: string
): Promise<Array<{
  id: string;
  resolvedAt: Date;
  resolvedBy: string;
  strategy: string;
  preferences: number;
}>> {
  const resolved = await prisma.preferenceApplication.findMany({
    where: {
      deliberationId,
      conflictStatus: "resolved",
    },
    select: {
      id: true,
      conflictResolvedAt: true,
      conflictResolvedBy: true,
      conflictResolution: true,
    },
    orderBy: { conflictResolvedAt: "desc" },
  });

  return resolved
    .filter(r => r.conflictResolvedAt && r.conflictResolvedBy)
    .map(r => ({
      id: r.id,
      resolvedAt: r.conflictResolvedAt!,
      resolvedBy: r.conflictResolvedBy!,
      strategy: (r.conflictResolution as any)?.strategy ?? "unknown",
      preferences: 1,
    }));
}
