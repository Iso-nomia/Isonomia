/**
 * Backfill Composition Tracking Script
 * 
 * This script identifies arguments that are "composed" (have premise chains)
 * and marks their ArgumentSupport records with composed=true.
 * 
 * An argument is considered composed if:
 * 1. It has ArgumentEdge records with type='support' pointing TO it (toArgumentId), OR
 * 2. It has ArgumentPremise records linking premise claims
 * 
 * Run with: tsx scripts/backfill-composition-tracking.ts
 */

import { prisma } from "../lib/prismaclient";

interface Stats {
  total: number;
  alreadyMarked: number;
  viaPremises: number;
  viaEdges: number;
  updated: number;
  failed: number;
}

async function main() {
  console.log("=== Backfill Composition Tracking ===\n");
  console.log("Starting analysis...\n");

  const stats: Stats = {
    total: 0,
    alreadyMarked: 0,
    viaPremises: 0,
    viaEdges: 0,
    updated: 0,
    failed: 0,
  };

  // Step 1: Get all ArgumentSupport records
  const allSupport = await prisma.argumentSupport.findMany({
    select: {
      id: true,
      argumentId: true,
      composed: true,
    },
  });

  stats.total = allSupport.length;
  console.log(`Found ${stats.total} ArgumentSupport records\n`);

  // Count already marked
  stats.alreadyMarked = allSupport.filter(s => s.composed).length;
  console.log(`Already marked as composed: ${stats.alreadyMarked} (${((stats.alreadyMarked / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Need to check: ${stats.total - stats.alreadyMarked}\n`);

  // Step 2: Check each unmarked ArgumentSupport for composition
  const toCheck = allSupport.filter(s => !s.composed);
  console.log("Checking for composition via ArgumentEdge and ArgumentPremise...\n");

  let processed = 0;
  for (const support of toCheck) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`  Progress: ${processed}/${toCheck.length}`);
    }

    try {
      // Check Method 1: ArgumentEdge with type='support' pointing to this argument
      const edgeCount = await prisma.argumentEdge.count({
        where: {
          toArgumentId: support.argumentId,
          type: "support",
        },
      });

      if (edgeCount > 0) {
        stats.viaEdges++;
        await prisma.argumentSupport.updateMany({
          where: { argumentId: support.argumentId },
          data: { 
            composed: true,
            rationale: `Composed via ${edgeCount} ArgumentEdge support links`,
            updatedAt: new Date(),
          },
        });
        stats.updated++;
        continue;
      }

      // Check Method 2: ArgumentPremise records
      const premiseCount = await prisma.argumentPremise.count({
        where: {
          argumentId: support.argumentId,
        },
      });

      if (premiseCount > 0) {
        stats.viaPremises++;
        await prisma.argumentSupport.updateMany({
          where: { argumentId: support.argumentId },
          data: { 
            composed: true,
            rationale: `Composed via ${premiseCount} ArgumentPremise links`,
            updatedAt: new Date(),
          },
        });
        stats.updated++;
      }
    } catch (err) {
      console.error(`  ❌ Failed to process ${support.argumentId}:`, (err as Error).message);
      stats.failed++;
    }
  }

  // Step 3: Final verification
  console.log("\n=== Final Verification ===\n");
  
  const finalCounts = await prisma.argumentSupport.groupBy({
    by: ['composed'],
    _count: true,
  });

  console.log("Final composition status:");
  for (const group of finalCounts) {
    const label = group.composed ? "Composed" : "Not Composed";
    const pct = ((group._count / stats.total) * 100).toFixed(1);
    console.log(`  ${label}: ${group._count} (${pct}%)`);
  }

  // Step 4: Coverage by deliberation
  console.log("\n=== Coverage by Deliberation ===\n");
  
  const byDelib = await prisma.argumentSupport.groupBy({
    by: ['deliberationId', 'composed'],
    _count: true,
  });

  const delibMap = new Map<string, { total: number; composed: number }>();
  for (const row of byDelib) {
    if (!delibMap.has(row.deliberationId)) {
      delibMap.set(row.deliberationId, { total: 0, composed: 0 });
    }
    const stats = delibMap.get(row.deliberationId)!;
    stats.total += row._count;
    if (row.composed) {
      stats.composed += row._count;
    }
  }

  const delibStats = Array.from(delibMap.entries())
    .map(([id, stats]) => ({
      id,
      total: stats.total,
      composed: stats.composed,
      pct: ((stats.composed / stats.total) * 100).toFixed(1),
    }))
    .sort((a, b) => b.total - a.total);

  console.log("Top deliberations by ArgumentSupport count:");
  console.log(
    "┌─────────────────────────────────┬───────┬──────────┬────────┐"
  );
  console.log(
    "│ Deliberation ID                 │ Total │ Composed │ % Comp │"
  );
  console.log(
    "├─────────────────────────────────┼───────┼──────────┼────────┤"
  );
  
  for (const d of delibStats.slice(0, 10)) {
    const idShort = d.id.substring(0, 28).padEnd(28);
    const total = String(d.total).padStart(5);
    const comp = String(d.composed).padStart(8);
    const pct = (d.pct + "%").padStart(6);
    console.log(`│ ${idShort}... │ ${total} │ ${comp} │ ${pct} │`);
  }
  
  console.log(
    "└─────────────────────────────────┴───────┴──────────┴────────┘"
  );

  // Step 5: Summary
  console.log("\n=== Summary ===\n");
  console.log(`Total ArgumentSupport records: ${stats.total}`);
  console.log(`Already marked as composed: ${stats.alreadyMarked}`);
  console.log(`Detected via ArgumentEdge: ${stats.viaEdges}`);
  console.log(`Detected via ArgumentPremise: ${stats.viaPremises}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Failed: ${stats.failed}`);
  
  const finalComposed = stats.alreadyMarked + stats.updated;
  const finalPct = ((finalComposed / stats.total) * 100).toFixed(1);
  console.log(`\nFinal composed count: ${finalComposed} (${finalPct}%)`);

  console.log("\n✅ Backfill complete!");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
