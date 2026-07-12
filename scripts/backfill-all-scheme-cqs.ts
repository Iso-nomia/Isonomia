#!/usr/bin/env npx tsx
/**
 * Backfill CriticalQuestion table for ALL schemes
 * 
 * This script:
 * 1. Finds all schemes with CQs in the JSON field (cq)
 * 2. Checks if they already have CriticalQuestion records
 * 3. Creates CriticalQuestion records if missing
 * 
 * Run: npx tsx scripts/backfill-all-scheme-cqs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CQJson {
  cqKey: string | null;
  text: string;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "conclusion" | "inference" | "premise";
}

async function main() {
  console.log("🔄 Starting CriticalQuestion backfill for all schemes...\n");

  // Fetch all schemes
  const allSchemes = await prisma.argumentScheme.findMany({
    include: { cqs: true },
  });

  console.log(`📋 Found ${allSchemes.length} total schemes\n`);

  let processed = 0;
  let skipped = 0;
  let created = 0;
  let errors = 0;

  for (const scheme of allSchemes) {
    const jsonCQs = (scheme.cq as any) || {};
    const cqsArray: CQJson[] = Array.isArray(jsonCQs)
      ? jsonCQs
      : Array.isArray(jsonCQs.questions)
      ? jsonCQs.questions.map((text: string, i: number) => ({
          cqKey: `CQ${i + 1}`,
          text,
          attackType: "REBUTS" as const,
          targetScope: "conclusion" as const,
        }))
      : [];

    // Skip if no CQs in JSON
    if (cqsArray.length === 0) {
      console.log(`⏭️  ${scheme.name} (${scheme.key}): No CQs in JSON, skipping`);
      skipped++;
      continue;
    }

    // Check if already has CriticalQuestion records
    const existingCount = scheme.cqs.length;

    if (existingCount > 0) {
      console.log(
        `✅ ${scheme.name} (${scheme.key}): Already has ${existingCount} CQ records, skipping`
      );
      skipped++;
      continue;
    }

    // Create CriticalQuestion records
    try {
      console.log(
        `🔨 ${scheme.name} (${scheme.key}): Creating ${cqsArray.length} CQ records...`
      );

      const createData = cqsArray.map((cq) => ({
        schemeId: scheme.id,
        instanceId: null,
        cqKey: cq.cqKey || `cq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: cq.text,
        attackType: cq.attackType,
        attackKind: cq.attackType, // Duplicate field for compatibility
        targetScope: cq.targetScope,
        status: "open" as const,
        openedById: null,
      }));

      const result = await prisma.criticalQuestion.createMany({
        data: createData as any, // Type assertion for nullable fields
        skipDuplicates: true,
      });

      console.log(
        `   ✅ Created ${result.count} CriticalQuestion records for ${scheme.name}\n`
      );

      created += result.count;
      processed++;
    } catch (error) {
      console.error(
        `   ❌ Error creating CQs for ${scheme.name}:`,
        error instanceof Error ? error.message : error
      );
      errors++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 BACKFILL SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total schemes:           ${allSchemes.length}`);
  console.log(`Processed (migrated):    ${processed}`);
  console.log(`Skipped (already done):  ${skipped}`);
  console.log(`CQ records created:      ${created}`);
  console.log(`Errors:                  ${errors}`);
  console.log();

  if (errors === 0 && processed > 0) {
    console.log("🎉 All schemes successfully backfilled!");
  } else if (errors === 0 && processed === 0) {
    console.log("✨ All schemes already have CriticalQuestion records!");
  } else if (errors > 0) {
    console.log(`⚠️  Completed with ${errors} error(s). Check logs above.`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
