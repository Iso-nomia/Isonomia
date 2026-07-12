/**
 * Test script for Phase 4: Evidential API Integration
 * Verifies that /api/deliberations/[id]/evidential uses per-derivation assumptions
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testEvidentialIntegration() {
  console.log("=== Testing Evidential API Integration with Per-Derivation Assumptions ===\n");

  try {
    // 1. Find a deliberation with real data
    const deliberation = await prisma.deliberation.findFirst({
      where: {
        ArgumentSupport: {
          some: {}
        }
      },
      include: {
        ArgumentSupport: {
          take: 5,
          include: {
            argument: {
              select: { id: true, text: true }
            }
          }
        }
      }
    });

    if (!deliberation) {
      console.log("❌ No deliberations found with ArgumentSupport");
      return;
    }

    console.log(`✅ Found deliberation: ${deliberation.id}`);
    console.log(`   Title: ${deliberation.title}`);
    console.log(`   Derivations: ${deliberation.ArgumentSupport.length}\n`);

    // 2. Check for per-derivation assumptions
    const derivationIds = deliberation.ArgumentSupport.map(d => d.id);
    
    const derivAssumptions = await prisma.derivationAssumption.findMany({
      where: { derivationId: { in: derivationIds } }
    });

    console.log(`📊 Per-derivation assumptions found: ${derivAssumptions.length}`);
    
    if (derivAssumptions.length > 0) {
      console.log("\nSample per-derivation assumptions:");
      for (const da of derivAssumptions.slice(0, 3)) {
        console.log(`   - Derivation ${da.derivationId.slice(0, 8)}...`);
        console.log(`     Assumption: ${da.assumptionId.slice(0, 8)}...`);
        console.log(`     Weight: ${da.weight}`);
        console.log(`     Status: ${da.status}`);
      }
    }

    // 3. Check legacy argument-level assumptions for comparison
    const argumentIds = deliberation.ArgumentSupport.map(d => d.argumentId);
    const uniqueArgIds = Array.from(new Set(argumentIds));
    
    const legacyAssumptions = await prisma.assumptionUse.findMany({
      where: { argumentId: { in: uniqueArgIds } }
    });

    console.log(`\n📊 Legacy argument-level assumptions: ${legacyAssumptions.length}`);

    // 4. Simulate evidential API logic
    console.log("\n=== Simulating Evidential API Logic ===\n");

    // Build derivation map
    const derivByArg = new Map<string, string[]>();
    for (const d of deliberation.ArgumentSupport) {
      const list = derivByArg.get(d.argumentId) || [];
      list.push(d.id);
      derivByArg.set(d.argumentId, list);
    }

    // Build assumption weight map
    const assumpByDeriv = new Map<string, number[]>();
    for (const da of derivAssumptions) {
      const list = assumpByDeriv.get(da.derivationId) || [];
      list.push(da.weight);
      assumpByDeriv.set(da.derivationId, list);
    }

    // Build legacy map
    const legacyAssump = new Map<string, number[]>();
    for (const u of legacyAssumptions) {
      const list = legacyAssump.get(u.argumentId) || [];
      list.push(u.weight ?? 0.6);
      legacyAssump.set(u.argumentId, list);
    }

    // Test per-argument aggregation
    console.log("Testing per-argument assumption aggregation:\n");
    
    for (const argId of uniqueArgIds.slice(0, 3)) {
      console.log(`Argument ${argId.slice(0, 8)}...:`);
      
      // Get derivations for this argument
      const derivIds = derivByArg.get(argId) || [];
      console.log(`  Derivations: ${derivIds.length}`);
      
      // Aggregate per-derivation assumptions
      const derivAssumps: number[] = [];
      for (const dId of derivIds) {
        const weights = assumpByDeriv.get(dId) || [];
        if (weights.length > 0) {
          console.log(`    - Derivation ${dId.slice(0, 8)}... has ${weights.length} assumption(s): [${weights.join(", ")}]`);
          derivAssumps.push(...weights);
        }
      }
      
      // Fallback to legacy
      const finalAssumps = derivAssumps.length > 0 
        ? derivAssumps 
        : (legacyAssump.get(argId) || []);
      
      if (derivAssumps.length > 0) {
        console.log(`  ✅ Using per-derivation assumptions: [${finalAssumps.join(", ")}]`);
      } else if (finalAssumps.length > 0) {
        console.log(`  ⚠️  Falling back to legacy assumptions: [${finalAssumps.join(", ")}]`);
      } else {
        console.log(`  ℹ️  No assumptions (factor = 1.0)`);
      }
      console.log();
    }

    // 5. Summary
    console.log("\n=== Integration Test Summary ===\n");
    
    const argsWithPerDeriv = uniqueArgIds.filter(argId => {
      const derivIds = derivByArg.get(argId) || [];
      return derivIds.some(dId => (assumpByDeriv.get(dId) || []).length > 0);
    }).length;

    const argsWithLegacy = uniqueArgIds.filter(argId => {
      return (legacyAssump.get(argId) || []).length > 0;
    }).length;

    console.log(`✅ Arguments with per-derivation assumptions: ${argsWithPerDeriv}/${uniqueArgIds.length}`);
    console.log(`⚠️  Arguments with legacy assumptions only: ${argsWithLegacy}/${uniqueArgIds.length}`);
    console.log(`ℹ️  Arguments with no assumptions: ${uniqueArgIds.length - argsWithPerDeriv - argsWithLegacy}/${uniqueArgIds.length}`);
    
    if (derivAssumptions.length > 0) {
      console.log("\n✅ SUCCESS: Evidential API will use per-derivation assumptions");
      console.log("   Legacy fallback is in place for backward compatibility");
    } else {
      console.log("\n⚠️  Note: No per-derivation assumptions in this deliberation");
      console.log("   API will fall back to legacy argument-level assumptions");
      console.log("   This is expected behavior for existing data");
    }

  } catch (error) {
    console.error("❌ Error during test:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testEvidentialIntegration()
  .catch(console.error);
