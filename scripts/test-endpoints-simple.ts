// scripts/test-endpoints-simple.ts
/**
 * Simple test for Gap 4 endpoints - tests database queries directly
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testQueries() {
  console.log("🧪 Testing Gap 4 Database Queries\n");
  console.log("=" .repeat(60));

  try {
    // Find test data
    const support = await prisma.argumentSupport.findFirst({
      select: { id: true, argumentId: true, claimId: true }
    });

    if (!support) {
      console.log("❌ No ArgumentSupport found");
      return;
    }

    console.log(`\n✅ Found derivation: ${support.id}\n`);

    // Test 1: Check if DerivationAssumption table is accessible
    console.log("Test 1: Query DerivationAssumption table\n");
    try {
      const links = await prisma.derivationAssumption.findMany({
        where: { derivationId: support.id },
        take: 5
      });
      console.log(`✅ Found ${links.length} DerivationAssumption links`);
      if (links.length > 0) {
        console.log(`   Sample:`, JSON.stringify(links[0], null, 2));
      }
    } catch (error: any) {
      console.log(`❌ Error:`, error.message);
    }

    // Test 2: Check AssumptionUse with status field
    console.log("\nTest 2: Query AssumptionUse with status\n");
    try {
      const assumptions = await prisma.assumptionUse.findMany({
        where: {
          argumentId: support.argumentId
        },
        take: 5
      });
      console.log(`✅ Found ${assumptions.length} AssumptionUse records`);
      if (assumptions.length > 0) {
        const first = assumptions[0] as any;
        console.log(`   Sample status: ${first.status || 'NO STATUS FIELD'}`);
      }
    } catch (error: any) {
      console.log(`❌ Error:`, error.message);
    }

    // Test 3: Create a test link
    console.log("\nTest 3: Create DerivationAssumption link\n");
    
    const testAssumption = await prisma.assumptionUse.findFirst({
      where: { argumentId: support.argumentId },
      select: { id: true }
    });

    if (!testAssumption) {
      console.log("⚠️  No assumptions found to link");
    } else {
      try {
        const link = await prisma.derivationAssumption.upsert({
          where: {
            derivationId_assumptionId: {
              derivationId: support.id,
              assumptionId: testAssumption.id
            }
          },
          create: {
            derivationId: support.id,
            assumptionId: testAssumption.id,
            weight: 0.9,
            inferredFrom: null
          },
          update: {
            weight: 0.9
          }
        });
        console.log(`✅ Link created/updated: ${link.id}`);
        console.log(`   Weight: ${link.weight}`);
      } catch (error: any) {
        console.log(`❌ Error:`, error.message);
      }
    }

    // Test 4: Batch query
    console.log("\nTest 4: Batch query all links for argument\n");
    try {
      const allSupports = await prisma.argumentSupport.findMany({
        where: { argumentId: support.argumentId },
        select: { id: true }
      });
      
      const derivationIds = allSupports.map(s => s.id);
      console.log(`   Found ${derivationIds.length} derivations`);

      const allLinks = await prisma.derivationAssumption.findMany({
        where: { derivationId: { in: derivationIds } }
      });
      
      console.log(`✅ Found ${allLinks.length} total links`);
      
      // Group by derivation
      const byDeriv = new Map<string, number>();
      for (const link of allLinks) {
        byDeriv.set(link.derivationId, (byDeriv.get(link.derivationId) || 0) + 1);
      }
      
      console.log(`   Links per derivation:`, Object.fromEntries(byDeriv));
    } catch (error: any) {
      console.log(`❌ Error:`, error.message);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ All database tests complete!\n");

  } catch (error: any) {
    console.error("\n❌ Test error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testQueries();
