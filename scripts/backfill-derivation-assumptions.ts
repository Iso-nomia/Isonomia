#!/usr/bin/env tsx
/**
 * Backfill Script: DerivationAssumption
 * 
 * Purpose: Migrate existing AssumptionUse data to new DerivationAssumption junction table.
 * 
 * Strategy:
 * - For each ACCEPTED AssumptionUse (linked to an argument)
 * - Find all ArgumentSupport records (derivations) for that argument
 * - Create DerivationAssumption link for each (derivation, assumption) pair
 * 
 * Idempotent: Safe to run multiple times (skips existing links)
 * 
 * Usage:
 *   npm run tsx scripts/backfill-derivation-assumptions.ts
 *   # or
 *   tsx scripts/backfill-derivation-assumptions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfillDerivationAssumptions() {
  console.log("🔄 Starting DerivationAssumption backfill...\n");

  // 1. Count existing AssumptionUse records
  const totalAssumptions = await prisma.assumptionUse.count();
  const acceptedAssumptions = await prisma.assumptionUse.count({
    where: { status: "ACCEPTED" }
  });
  
  console.log(`📊 Found ${totalAssumptions} total assumptions`);
  console.log(`   └─ ${acceptedAssumptions} ACCEPTED assumptions\n`);

  // 2. Fetch all ACCEPTED assumptions
  const assumptions = await prisma.assumptionUse.findMany({
    where: { status: "ACCEPTED" },
    select: {
      id: true,
      argumentId: true,
      weight: true,
      deliberationId: true
    }
  });

  let linksCreated = 0;
  let linksSkipped = 0;
  let errors = 0;

  console.log("🔗 Creating derivation-assumption links...\n");

  // 3. Process each assumption
  for (let i = 0; i < assumptions.length; i++) {
    const assump = assumptions[i];
    
    // Progress indicator every 10 assumptions
    if (i % 10 === 0) {
      console.log(`   Progress: ${i}/${assumptions.length} assumptions processed...`);
    }

    try {
      // Find all ArgumentSupport (derivations) for this argument
      const supports = await prisma.argumentSupport.findMany({
        where: { 
          argumentId: assump.argumentId,
          deliberationId: assump.deliberationId  // Ensure same deliberation
        },
        select: { id: true }
      });

      if (supports.length === 0) {
        console.log(`   ⚠️  No derivations found for argument ${assump.argumentId}`);
        continue;
      }

      // Create DerivationAssumption for each support
      for (const support of supports) {
        try {
          // Check if link already exists
          const existing = await prisma.derivationAssumption.findUnique({
            where: {
              derivationId_assumptionId: {
                derivationId: support.id,
                assumptionId: assump.id
              }
            }
          });

          if (existing) {
            linksSkipped++;
            continue;
          }

          // Create new link
          await prisma.derivationAssumption.create({
            data: {
              derivationId: support.id,
              assumptionId: assump.id,
              weight: assump.weight ?? 1.0,
              inferredFrom: null  // Original assumption (not transitive)
            }
          });
          
          linksCreated++;
        } catch (error) {
          console.error(`   ❌ Error creating link for derivation ${support.id}:`, error);
          errors++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing assumption ${assump.id}:`, error);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Backfill Complete!\n");
  console.log(`📈 Statistics:`);
  console.log(`   • Assumptions processed: ${assumptions.length}`);
  console.log(`   • Links created: ${linksCreated}`);
  console.log(`   • Links skipped (already exist): ${linksSkipped}`);
  console.log(`   • Errors: ${errors}`);
  console.log("=".repeat(60) + "\n");

  // 4. Verification query
  console.log("🔍 Verification:\n");
  const totalLinks = await prisma.derivationAssumption.count();
  const uniqueDerivations = await prisma.derivationAssumption.groupBy({
    by: ["derivationId"],
    _count: true
  });
  const uniqueAssumptions = await prisma.derivationAssumption.groupBy({
    by: ["assumptionId"],
    _count: true
  });

  console.log(`   • Total DerivationAssumption records: ${totalLinks}`);
  console.log(`   • Unique derivations linked: ${uniqueDerivations.length}`);
  console.log(`   • Unique assumptions linked: ${uniqueAssumptions.length}`);
  
  const avgLinksPerDeriv = totalLinks / (uniqueDerivations.length || 1);
  const avgLinksPerAssump = totalLinks / (uniqueAssumptions.length || 1);
  
  console.log(`   • Avg assumptions per derivation: ${avgLinksPerDeriv.toFixed(2)}`);
  console.log(`   • Avg derivations per assumption: ${avgLinksPerAssump.toFixed(2)}`);
  console.log("");
}

// Run backfill
backfillDerivationAssumptions()
  .catch((error) => {
    console.error("❌ Fatal error during backfill:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("✨ Database connection closed.");
  });
