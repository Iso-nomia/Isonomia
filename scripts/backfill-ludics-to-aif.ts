import { prisma } from "@/lib/prismaclient";
import { syncLudicsToAif } from "@/lib/ludics/syncToAif";

/**
 * Backfill script: Sync existing LudicAct rows to AifNode
 * 
 * This script processes all deliberations that have Ludics data
 * and ensures their LudicAct rows are synced to the AifNode table.
 * 
 * Usage:
 *   npx tsx scripts/backfill-ludics-to-aif.ts
 *   npx tsx scripts/backfill-ludics-to-aif.ts --deliberation-id delib_123
 */

async function backfillLudicsToAif(targetDeliberationId?: string) {
  console.log("\n🔄 Starting Ludics → AifNode backfill...\n");

  try {
    // Get all deliberations with Ludics data (or specific one)
    const deliberationsWithLudics = await prisma.ludicDesign.groupBy({
      by: ["deliberationId"],
      _count: { id: true },
      where: targetDeliberationId ? { deliberationId: targetDeliberationId } : undefined,
    });

    if (deliberationsWithLudics.length === 0) {
      console.log("❌ No deliberations found with Ludics data");
      if (targetDeliberationId) {
        console.log(`   Deliberation ID: ${targetDeliberationId}`);
      }
      return;
    }

    console.log(`📊 Found ${deliberationsWithLudics.length} deliberation(s) to process\n`);

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalEdges = 0;
    let errors = 0;

    for (const [index, delib] of deliberationsWithLudics.entries()) {
      const deliberationId = delib.deliberationId;
      console.log(`[${index + 1}/${deliberationsWithLudics.length}] Processing: ${deliberationId}`);

      try {
        const result = await syncLudicsToAif(deliberationId);
        
        totalCreated += result.nodesCreated;
        totalUpdated += result.nodesUpdated;
        totalEdges += result.edgesCreated;

        console.log(
          `  ✅ Created: ${result.nodesCreated} | Updated: ${result.nodesUpdated} | Edges: ${result.edgesCreated}`
        );
      } catch (error) {
        errors++;
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 Backfill Complete!");
    console.log("=".repeat(60));
    console.log(`Total AifNodes created: ${totalCreated}`);
    console.log(`Total AifNodes updated: ${totalUpdated}`);
    console.log(`Total AifEdges created: ${totalEdges}`);
    console.log(`Errors encountered: ${errors}`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line args
const args = process.argv.slice(2);
const deliberationIdIndex = args.indexOf("--deliberation-id");
const targetDeliberationId =
  deliberationIdIndex !== -1 ? args[deliberationIdIndex + 1] : undefined;

if (targetDeliberationId) {
  console.log(`🎯 Targeting specific deliberation: ${targetDeliberationId}\n`);
}

backfillLudicsToAif(targetDeliberationId);
