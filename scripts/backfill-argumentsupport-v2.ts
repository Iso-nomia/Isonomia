// scripts/backfill-argumentsupport-v2.ts
/**
 * PHASE 1: Backfill ArgumentSupport records for legacy arguments
 * 
 * This script finds all arguments with conclusions that lack ArgumentSupport
 * records and creates them with appropriate base confidence values.
 * 
 * Usage: tsx scripts/backfill-argumentsupport-v2.ts
 */

import { prisma } from "@/lib/prismaclient";
import { DEFAULT_ARGUMENT_CONFIDENCE } from "@/lib/config/confidence";

async function backfillArgumentSupport() {
  console.log("=".repeat(80));
  console.log("PHASE 1: ArgumentSupport Backfill Script v2");
  console.log("=".repeat(80));
  console.log("");
  
  console.log("Step 1: Finding arguments without ArgumentSupport records...");
  
  // Find all arguments with conclusions but no support record
  // Note: We can't use ArgumentSupport relation directly in Prisma query
  // because the relation might not be defined in schema. Use raw query instead.
  
  const orphanedArgs = await prisma.$queryRaw<Array<{
    id: string;
    claimId: string;
    deliberationId: string;
    confidence: number | null;
    createdAt: Date;
  }>>`
    SELECT 
      a.id,
      a."claimId",
      a."deliberationId",
      a.confidence,
      a."createdAt"
    FROM "Argument" a
    WHERE a."claimId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ArgumentSupport" s 
        WHERE s."argumentId" = a.id
      )
    ORDER BY a."createdAt" DESC
  `;
  
  console.log(`Found ${orphanedArgs.length} arguments without support records\n`);
  
  if (orphanedArgs.length === 0) {
    console.log("✅ All arguments have ArgumentSupport records. Nothing to backfill.\n");
    return;
  }
  
  // Show sample of what will be backfilled
  console.log("Sample of arguments to backfill (first 5):");
  orphanedArgs.slice(0, 5).forEach((arg, idx) => {
    console.log(`  ${idx + 1}. ${arg.id.slice(0, 8)}... (delib: ${arg.deliberationId.slice(0, 8)}..., confidence: ${arg.confidence ?? 'null'})`);
  });
  console.log("");
  
  console.log("Step 2: Creating ArgumentSupport records...");
  
  let created = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const arg of orphanedArgs) {
    try {
      await prisma.argumentSupport.create({
        data: {
          argumentId: arg.id,
          claimId: arg.claimId,
          deliberationId: arg.deliberationId,
          base: arg.confidence ?? DEFAULT_ARGUMENT_CONFIDENCE,
          rationale: "Backfilled from legacy data (v2 script)",
        },
      });
      created++;
      
      // Progress indicator every 10 records
      if (created % 10 === 0) {
        console.log(`  Progress: ${created}/${orphanedArgs.length} records created...`);
      }
    } catch (error: any) {
      // Check if it's a duplicate error (P2002 = unique constraint violation)
      if (error.code === "P2002") {
        skipped++;
        console.log(`  ⚠️  Skipped ${arg.id.slice(0, 8)}... (duplicate)`);
      } else {
        failed++;
        console.error(`  ❌ Failed to backfill ${arg.id.slice(0, 8)}...: ${error.message}`);
      }
    }
  }
  
  console.log("");
  console.log("=".repeat(80));
  console.log("Backfill Summary");
  console.log("=".repeat(80));
  console.log(`✅ Created:  ${created} records`);
  console.log(`⚠️  Skipped:  ${skipped} records (duplicates)`);
  console.log(`❌ Failed:   ${failed} records (errors)`);
  console.log(`📊 Total:    ${orphanedArgs.length} arguments processed`);
  console.log("");
  
  // Verification step
  console.log("Step 3: Verifying no orphaned arguments remain...");
  
  const remainingOrphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "Argument" a
    WHERE a."claimId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ArgumentSupport" s 
        WHERE s."argumentId" = a.id
      )
  `;
  
  const orphanCount = Number(remainingOrphans[0]?.count ?? 0);
  
  if (orphanCount === 0) {
    console.log("✅ Verification passed: No orphaned arguments remain.\n");
  } else {
    console.log(`⚠️  Warning: ${orphanCount} orphaned arguments still remain.`);
    console.log("   This may indicate arguments that failed to backfill.\n");
  }
  
  // Coverage statistics by deliberation
  console.log("Step 4: Coverage statistics by deliberation...\n");
  
  const coverageStats = await prisma.$queryRaw<Array<{
    deliberation_id: string;
    total_arguments: bigint;
    supported_arguments: bigint;
    coverage_pct: string;
  }>>`
    SELECT 
      d.id as deliberation_id,
      COUNT(DISTINCT a.id) as total_arguments,
      COUNT(DISTINCT s."argumentId") as supported_arguments,
      ROUND(100.0 * COUNT(DISTINCT s."argumentId") / NULLIF(COUNT(DISTINCT a.id), 0), 1)::text as coverage_pct
    FROM "Deliberation" d
    LEFT JOIN "Argument" a ON a."deliberationId" = d.id AND a."claimId" IS NOT NULL
    LEFT JOIN "ArgumentSupport" s ON s."argumentId" = a.id
    GROUP BY d.id
    HAVING COUNT(DISTINCT a.id) > 0
    ORDER BY CAST(ROUND(100.0 * COUNT(DISTINCT s."argumentId") / NULLIF(COUNT(DISTINCT a.id), 0), 1) AS NUMERIC) ASC
    LIMIT 10
  `;
  
  console.log("Top 10 deliberations with lowest coverage:");
  console.log("┌─────────────────────────┬───────┬───────────┬──────────┐");
  console.log("│ Deliberation ID         │ Total │ Supported │ Coverage │");
  console.log("├─────────────────────────┼───────┼───────────┼──────────┤");
  
  coverageStats.forEach(stat => {
    const id = stat.deliberation_id.slice(0, 23).padEnd(23);
    const total = String(stat.total_arguments).padStart(5);
    const supported = String(stat.supported_arguments).padStart(9);
    const coverage = `${stat.coverage_pct}%`.padStart(8);
    console.log(`│ ${id} │ ${total} │ ${supported} │ ${coverage} │`);
  });
  
  console.log("└─────────────────────────┴───────┴───────────┴──────────┘");
  console.log("");
  
  console.log("=".repeat(80));
  console.log("Backfill Complete!");
  console.log("=".repeat(80));
  console.log("");
  console.log("Next Steps:");
  console.log("1. Review the coverage statistics above");
  console.log("2. Investigate any deliberations with <100% coverage");
  console.log("3. Monitor ArgumentSupport creation via Prisma middleware");
  console.log("4. Schedule monthly runs to catch any missed arguments");
  console.log("");
}

// Execute backfill
backfillArgumentSupport()
  .catch((error) => {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
