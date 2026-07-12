/**
 * Phase 3: Lazy Recomputation
 * 
 * Option 3: Recompute strength on-demand when reading ArgumentSupport
 * This avoids blocking write operations and defers computation until needed
 */

import { prisma } from "@/lib/prismaclient";
import { recomputeArgumentStrength } from "./recompute-strength";
import { computeArrowTags } from "@/lib/argumentation/eccAdapter";
import type { AssumptionId, AssumptionStatus } from "@/lib/argumentation/ecc";

const RECOMPUTE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if ArgumentSupport needs recomputation based on staleness
 * @param support - The ArgumentSupport record
 * @returns true if recomputation is needed
 */
function needsRecomputation(support: {
  composed: boolean;
  updatedAt: Date;
}): boolean {
  // Only recompute composed arguments (atomic arguments don't change)
  if (!support.composed) {
    return false;
  }

  // Recompute if not updated in last 5 minutes
  const staleness = Date.now() - support.updatedAt.getTime();
  return staleness > RECOMPUTE_THRESHOLD_MS;
}

/**
 * Lazily recompute ArgumentSupport strength if stale
 * Called during read operations to ensure fresh data
 * 
 * @param argumentId - The argument to check
 * @returns Updated strength value or null if no recomputation needed
 */
export async function lazyRecomputeIfNeeded(
  argumentId: string
): Promise<number | null> {
  const support = await prisma.argumentSupport.findFirst({
    where: { argumentId },
  });

  if (!support || !needsRecomputation(support)) {
    return null; // No recomputation needed
  }

  try {
    const result = await recomputeArgumentStrength(argumentId);

    // Update in database
    await prisma.argumentSupport.update({
      where: { id: support.id },
      data: {
        strength: result.newStrength,
        rationale: `Auto-recomputed: base=${result.baseStrength.toFixed(2)} × premises(${result.premiseCount})=${result.premiseFactor.toFixed(2)} × assumptions(${result.assumptionCount})=${result.assumptionFactor.toFixed(2)}`,
        updatedAt: new Date(),
      },
    });

    return result.newStrength;
  } catch (error) {
    console.error(`Failed to lazy recompute argument ${argumentId}:`, error);
    return null; // Return null on error, use existing strength
  }
}

/**
 * Batch lazy recomputation for multiple arguments
 * More efficient than individual calls
 * 
 * @param argumentIds - Array of argument IDs to check
 * @returns Map of argumentId -> new strength (only for recomputed arguments)
 */
export async function batchLazyRecompute(
  argumentIds: string[]
): Promise<Map<string, number>> {
  if (argumentIds.length === 0) {
    return new Map();
  }

  // Fetch all supports in one query
  const supports = await prisma.argumentSupport.findMany({
    where: { argumentId: { in: argumentIds } },
  });

  // Filter to only those needing recomputation
  const toRecompute = supports.filter(needsRecomputation);

  if (toRecompute.length === 0) {
    return new Map();
  }

  const results = new Map<string, number>();

  // Recompute in parallel (but don't await all - fire and forget for performance)
  const promises = toRecompute.map(async (support) => {
    try {
      const result = await recomputeArgumentStrength(support.argumentId);

      await prisma.argumentSupport.update({
        where: { id: support.id },
        data: {
          strength: result.newStrength,
          rationale: `Auto-recomputed: base=${result.baseStrength.toFixed(2)} × premises(${result.premiseCount})=${result.premiseFactor.toFixed(2)} × assumptions(${result.assumptionCount})=${result.assumptionFactor.toFixed(2)}`,
          updatedAt: new Date(),
        },
      });

      results.set(support.argumentId, result.newStrength);
    } catch (error) {
      console.error(`Failed to batch recompute argument ${support.argumentId}:`, error);
    }
  });

  // Wait for all recomputations to complete
  await Promise.all(promises);

  // Sprint B3 — write-time tagging hook. Tags are non-blocking metadata used
  // by the typed pipeline (Sprint B2) and the UI badges (Sprint B4); failure
  // here MUST NOT mask a successful recompute.
  await tagSupportsForArguments(argumentIds).catch((err) => {
    console.error("ECC tag write failed:", err);
  });

  return results;
}

/**
 * Compute and persist `metaJson.{simple,entire,selected,logical}` on every
 * `ArgumentSupport` row backing the given arguments. Pure additive write —
 * other `metaJson` keys are preserved.
 *
 * Sprint B3 contract: this is the only write hook that touches the ECC
 * tags. The backfill script `scripts/ecc-backfill-tags.ts` calls this same
 * helper so the two paths stay consistent.
 */
export async function tagSupportsForArguments(argumentIds: string[]): Promise<number> {
  if (argumentIds.length === 0) return 0;

  const supports = await prisma.argumentSupport.findMany({
    where: { argumentId: { in: argumentIds } },
    select: { id: true, argumentId: true, claimId: true, metaJson: true } as any,
  }) as unknown as Array<{ id: string; argumentId: string; claimId: string; metaJson: any }>;

  if (supports.length === 0) return 0;

  const supportIds = supports.map((s) => s.id);
  const derivAssumps = await prisma.derivationAssumption.findMany({
    where: { derivationId: { in: supportIds } },
    select: { derivationId: true, assumptionId: true, weight: true },
  });
  const assumIds = Array.from(new Set(derivAssumps.map((d) => d.assumptionId)));
  const assumStatusRows = assumIds.length
    ? await prisma.assumptionUse.findMany({
        where: { id: { in: assumIds } },
        select: { id: true, status: true },
      })
    : [];
  const statusMap = new Map<AssumptionId, AssumptionStatus>(
    assumStatusRows.map((r) => [r.id, (r.status as any) ?? "PROPOSED"])
  );

  // For per-row tagging we need the set of derivation ids backing each
  // (argumentId, claimId) pair — typically a singleton.
  const derivsByPair = new Map<string, string[]>();
  for (const s of supports) {
    const key = `${s.argumentId}|${s.claimId}`;
    const list = derivsByPair.get(key) ?? [];
    list.push(s.id);
    derivsByPair.set(key, list);
  }

  let written = 0;
  for (const s of supports) {
    const key = `${s.argumentId}|${s.claimId}`;
    const derivIds = derivsByPair.get(key) ?? [s.id];
    const tags = computeArrowTags({
      argumentId: s.argumentId,
      derivationIds: derivIds,
      derivationAssumptions: derivAssumps.filter((d) => derivIds.includes(d.derivationId)).map((d) => ({
        derivationId: d.derivationId,
        assumptionId: d.assumptionId,
        weight: d.weight,
      })),
      assumptionStatus: statusMap,
    });
    const existing = (s.metaJson && typeof s.metaJson === "object") ? s.metaJson as Record<string, any> : {};
    const nextMeta = { ...existing, ...tags };
    await prisma.argumentSupport.update({
      where: { id: s.id },
      data: { metaJson: nextMeta as any },
    });
    written++;
  }
  return written;
}
