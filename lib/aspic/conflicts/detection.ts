/**
 * Enhanced conflict detection with metadata enrichment
 * Builds on existing detectPreferenceCycles() from Phase 4
 */

import { detectPreferenceCycles } from "@/lib/aspic/translation/aifToASPIC";
import { prisma } from "@/lib/prismaclient";

export interface PreferenceInCycle {
  id: string;
  preferred: string;
  dispreferred: string;
  weight: number;
  createdAt: Date;
  createdBy: string;
  createdByName?: string;
  justification?: string;
}

export interface PreferenceConflict {
  type: "cycle";
  cycle: string[]; // Argument/Claim IDs in cycle order
  cycleDisplay: string; // "A → B → C → A"
  preferences: PreferenceInCycle[];
  severity: "critical"; // All cycles are critical
  detectedAt: Date;
}

/**
 * Detect all conflicts in deliberation preferences
 */
export async function detectConflicts(
  deliberationId: string
): Promise<PreferenceConflict[]> {
  // Fetch all PA records for this deliberation
  const paRecords = await prisma.preferenceApplication.findMany({
    where: { 
      deliberationId,
      OR: [
        { conflictStatus: { in: ["none", "detected"] } }, // Exclude already resolved
        { conflictStatus: null }, // Include records with no status set
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Build preference graph (reuse Phase 4 format)
  const prefs = paRecords.map(pa => ({
    preferred: pa.preferredArgumentId ?? pa.preferredClaimId ?? "",
    dispreferred: pa.dispreferredArgumentId ?? pa.dispreferredClaimId ?? "",
  })).filter(p => p.preferred && p.dispreferred);

  // Detect cycles using existing implementation
  const cycles = detectPreferenceCycles(prefs);

  const conflicts: PreferenceConflict[] = [];

  for (const cycle of cycles) {
    // Find PA records involved in this cycle
    const involvedPAs: PreferenceInCycle[] = [];

    for (let i = 0; i < cycle.length; i++) {
      const preferred = cycle[i];
      const dispreferred = cycle[(i + 1) % cycle.length];

      const pa = paRecords.find(r => {
        const pref = r.preferredArgumentId ?? r.preferredClaimId ?? "";
        const dispref = r.dispreferredArgumentId ?? r.dispreferredClaimId ?? "";
        return pref === preferred && dispref === dispreferred;
      });

      if (pa) {
        involvedPAs.push({
          id: pa.id,
          preferred: pa.preferredArgumentId ?? pa.preferredClaimId ?? "",
          dispreferred: pa.dispreferredArgumentId ?? pa.dispreferredClaimId ?? "",
          weight: pa.weight ?? 1.0,
          createdAt: pa.createdAt,
          createdBy: pa.createdById,
          justification: pa.justification ?? undefined,
        });
      }
    }

    if (involvedPAs.length > 0) {
      conflicts.push({
        type: "cycle",
        cycle,
        cycleDisplay: [...cycle, cycle[0]].join(" → "),
        preferences: involvedPAs,
        severity: "critical",
        detectedAt: new Date(),
      });
    }
  }

  return conflicts;
}

/**
 * Mark preferences as having detected conflict
 */
export async function markConflictDetected(
  paIds: string[]
): Promise<void> {
  if (paIds.length === 0) return;
  
  await prisma.preferenceApplication.updateMany({
    where: { id: { in: paIds } },
    data: { conflictStatus: "detected" },
  });
}
