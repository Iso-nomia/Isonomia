/**
 * Migrate ArgumentScheme.cq JSON data to CriticalQuestion table records
 * This enables the argument creation endpoint to find CQs via sc.cqs relation
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Migrating CQs from JSON to CriticalQuestion table...\n");

  const schemes = await prisma.argumentScheme.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      cq: true,
      cqs: {
        select: { id: true, cqKey: true }
      }
    }
  });

  let migrated = 0;
  let skipped = 0;

  for (const scheme of schemes) {
    const cqData = scheme.cq as any;
    
    // Skip if no CQs in JSON or if CQ records already exist
    if (!Array.isArray(cqData) || cqData.length === 0) {
      console.log(`⏭️  ${scheme.key}: No CQs in JSON field`);
      skipped++;
      continue;
    }

    if (scheme.cqs && scheme.cqs.length > 0) {
      console.log(`✅ ${scheme.key}: ${scheme.cqs.length} CQ records already exist`);
      skipped++;
      continue;
    }

    console.log(`📝 ${scheme.key}: Migrating ${cqData.length} CQs...`);

    try {
      await prisma.criticalQuestion.createMany({
        data: cqData.map((cq: any) => ({
          schemeId: scheme.id,
          cqKey: cq.cqKey,
          text: cq.text,
          attackKind: cq.attackType || "UNDERCUTS",
          status: "open",
          attackType: cq.attackType || "UNDERCUTS",
          targetScope: cq.targetScope || "inference",
        })) as any,
        skipDuplicates: true,
      });

      console.log(`   ✅ Created ${cqData.length} CriticalQuestion records`);
      migrated++;
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log("\n✨ Migration complete!");
  console.log(`   • Migrated: ${migrated} schemes`);
  console.log(`   • Skipped: ${skipped} schemes`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
