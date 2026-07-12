/**
 * Phase 3: Backfill Strength Recomputation
 * 
 * Recomputes ArgumentSupport.strength for all composed arguments based on:
 * - Base confidence
 * - Premise strengths (multiplicative product)
 * - Assumption weights (multiplicative product)
 * 
 * Expected impact: Fix "70% score clustering" by computing actual composed strengths
 */

import { prisma } from "@/lib/prismaclient";
import { recomputeArgumentStrength } from "@/lib/evidential/recompute-strength";

interface StrengthStats {
  total: number;
  composedCount: number;
  recomputed: number;
  failed: number;
  strengthBefore: { min: number; max: number; avg: number };
  strengthAfter: { min: number; max: number; avg: number };
  significantChanges: number; // Changed by >0.1
}

async function backfillStrengthRecomputation() {
  console.log("================================================================================");
  console.log("PHASE 3: Strength Recomputation Backfill");
  console.log("================================================================================\n");

  console.log("Step 1: Fetching all composed ArgumentSupport records...");

  // Fetch all composed arguments
  const composedSupports = await prisma.argumentSupport.findMany({
    where: { composed: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${composedSupports.length} composed ArgumentSupport records\n`);

  if (composedSupports.length === 0) {
    console.log("✅ No composed arguments to recompute. Exiting.");
    return;
  }

  // Calculate initial statistics
  const strengths = composedSupports.map(s => s.strength);
  const strengthBefore = {
    min: Math.min(...strengths),
    max: Math.max(...strengths),
    avg: strengths.reduce((a, b) => a + b, 0) / strengths.length,
  };

  console.log("Strength distribution BEFORE recomputation:");
  console.log(`  Min: ${strengthBefore.min.toFixed(3)}`);
  console.log(`  Max: ${strengthBefore.max.toFixed(3)}`);
  console.log(`  Avg: ${strengthBefore.avg.toFixed(3)}\n`);

  console.log("Step 2: Recomputing strengths...\n");

  const stats: StrengthStats = {
    total: composedSupports.length,
    composedCount: composedSupports.length,
    recomputed: 0,
    failed: 0,
    strengthBefore,
    strengthAfter: { min: 0, max: 0, avg: 0 },
    significantChanges: 0,
  };

  const newStrengths: number[] = [];
  let progressCounter = 0;

  for (const support of composedSupports) {
    try {
      // Recompute strength
      const result = await recomputeArgumentStrength(support.argumentId);

      // Update in database
      await prisma.argumentSupport.update({
        where: { id: support.id },
        data: {
          strength: result.newStrength,
          rationale: `Recomputed: base=${result.baseStrength.toFixed(2)} × premises(${result.premiseCount})=${result.premiseFactor.toFixed(2)} × assumptions(${result.assumptionCount})=${result.assumptionFactor.toFixed(2)}`,
          updatedAt: new Date(),
        },
      });

      newStrengths.push(result.newStrength);
      stats.recomputed++;

      // Track significant changes (>0.1 difference)
      const change = Math.abs(result.newStrength - support.strength);
      if (change > 0.1) {
        stats.significantChanges++;
      }

      // Progress indicator
      progressCounter++;
      if (progressCounter % 10 === 0) {
        console.log(`  Progress: ${progressCounter}/${composedSupports.length}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to recompute ${support.argumentId}:`, error.message);
      stats.failed++;
    }
  }

  console.log(`  Progress: ${progressCounter}/${composedSupports.length}\n`);

  // Calculate final statistics
  if (newStrengths.length > 0) {
    stats.strengthAfter = {
      min: Math.min(...newStrengths),
      max: Math.max(...newStrengths),
      avg: newStrengths.reduce((a, b) => a + b, 0) / newStrengths.length,
    };
  }

  console.log("=== Final Verification ===\n");

  console.log("Strength distribution AFTER recomputation:");
  console.log(`  Min: ${stats.strengthAfter.min.toFixed(3)}`);
  console.log(`  Max: ${stats.strengthAfter.max.toFixed(3)}`);
  console.log(`  Avg: ${stats.strengthAfter.avg.toFixed(3)}\n`);

  console.log("Changes:");
  console.log(`  Min change: ${(stats.strengthAfter.min - stats.strengthBefore.min).toFixed(3)}`);
  console.log(`  Max change: ${(stats.strengthAfter.max - stats.strengthBefore.max).toFixed(3)}`);
  console.log(`  Avg change: ${(stats.strengthAfter.avg - stats.strengthBefore.avg).toFixed(3)}\n`);

  // Get deliberation coverage
  console.log("=== Coverage by Deliberation ===\n");

  const deliberationStats = await prisma.$queryRaw<Array<{
    deliberationId: string;
    total: bigint;
    composed: bigint;
    avgStrength: number;
  }>>`
    SELECT 
      "deliberationId",
      COUNT(*) as total,
      SUM(CASE WHEN composed = true THEN 1 ELSE 0 END) as composed,
      AVG(CASE WHEN composed = true THEN strength ELSE NULL END) as "avgStrength"
    FROM "ArgumentSupport"
    GROUP BY "deliberationId"
    HAVING SUM(CASE WHEN composed = true THEN 1 ELSE 0 END) > 0
    ORDER BY composed DESC
    LIMIT 10
  `;

  console.log("Top deliberations with composed arguments (avg strength after recomputation):");
  console.log("┌─────────────────────────────────┬───────┬──────────┬──────────────┐");
  console.log("│ Deliberation ID                 │ Total │ Composed │ Avg Strength │");
  console.log("├─────────────────────────────────┼───────┼──────────┼──────────────┤");

  for (const row of deliberationStats) {
    const id = row.deliberationId.substring(0, 27) + "...";
    const total = Number(row.total);
    const composed = Number(row.composed);
    const avgStr = row.avgStrength?.toFixed(3) ?? "N/A";
    console.log(
      `│ ${id.padEnd(31)} │ ${String(total).padStart(5)} │ ${String(composed).padStart(8)} │ ${avgStr.padStart(12)} │`
    );
  }
  console.log("└─────────────────────────────────┴───────┴──────────┴──────────────┘\n");

  console.log("=== Summary ===\n");
  console.log(`Total ArgumentSupport records: ${stats.total}`);
  console.log(`Composed records: ${stats.composedCount}`);
  console.log(`Successfully recomputed: ${stats.recomputed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Significant changes (>0.1): ${stats.significantChanges}\n`);

  console.log("✅ Backfill complete!");
  console.log("\nExpected outcomes:");
  console.log("  - Strength values now reflect actual premise chains");
  console.log("  - 70% score clustering should be reduced");
  console.log("  - Composed arguments have lower strengths than base (due to multiplicative weakening)");
}

// Run the backfill
backfillStrengthRecomputation()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
