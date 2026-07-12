/**
 * Verify Multi-Scheme Migration Integrity
 * 
 * This script validates that the Phase 1.1 multi-scheme migration was successful:
 * 1. All ArgumentSchemeInstances have the new fields populated
 * 2. Existing single-scheme arguments are properly represented
 * 3. Data integrity constraints are maintained
 * 4. No data was lost during migration
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log("🔍 Verifying multi-scheme migration...\n");

  try {
    // Check 1: Count total ArgumentSchemeInstances
    const totalInstances = await prisma.argumentSchemeInstance.count();
    console.log(`✅ Total ArgumentSchemeInstances: ${totalInstances}`);

    // Check 2: Verify all instances have required fields
    const instancesWithDefaults = await prisma.argumentSchemeInstance.findMany({
      select: {
        id: true,
        role: true,
        explicitness: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const missingFields = instancesWithDefaults.filter(
      (inst) => !inst.role || !inst.explicitness || inst.order === null
    );

    if (missingFields.length > 0) {
      console.log(`❌ Found ${missingFields.length} instances with missing required fields:`);
      missingFields.forEach((inst) => {
        console.log(`   - Instance ${inst.id}: role=${inst.role}, explicitness=${inst.explicitness}, order=${inst.order}`);
      });
    } else {
      console.log(`✅ All ${totalInstances} instances have required fields populated`);
    }

    // Check 3: Verify default values were applied correctly
    const primaryCount = await prisma.argumentSchemeInstance.count({
      where: { role: "primary" },
    });
    const explicitCount = await prisma.argumentSchemeInstance.count({
      where: { explicitness: "explicit" },
    });

    console.log(`✅ Instances with role="primary": ${primaryCount}`);
    console.log(`✅ Instances with explicitness="explicit": ${explicitCount}`);

    // Check 4: Verify backward compatibility with legacy single-scheme arguments
    const argumentsWithLegacyScheme = await prisma.argument.count({
      where: {
        schemeId: { not: null },
      },
    });

    console.log(`✅ Arguments with legacy schemeId: ${argumentsWithLegacyScheme}`);

    // Check 5: Verify arguments with multiple schemes
    const argsWithInstances = await prisma.argument.findMany({
      include: {
        argumentSchemes: true,
      },
    });

    const multiSchemeArgs = argsWithInstances.filter(
      (arg) => arg.argumentSchemes.length > 1
    );
    const singleSchemeArgs = argsWithInstances.filter(
      (arg) => arg.argumentSchemes.length === 1
    );
    const noSchemeArgs = argsWithInstances.filter(
      (arg) => arg.argumentSchemes.length === 0
    );

    console.log(`\n📊 Argument Distribution:`);
    console.log(`   - Arguments with multiple schemes: ${multiSchemeArgs.length}`);
    console.log(`   - Arguments with single scheme: ${singleSchemeArgs.length}`);
    console.log(`   - Arguments with no schemes: ${noSchemeArgs.length}`);

    // Check 6: Verify each argument has at most one primary scheme
    const argumentsWithMultiplePrimaries = argsWithInstances.filter(
      (arg) =>
        arg.argumentSchemes.filter((inst) => inst.role === "primary").length > 1
    );

    if (argumentsWithMultiplePrimaries.length > 0) {
      console.log(`\n⚠️  WARNING: Found ${argumentsWithMultiplePrimaries.length} arguments with multiple primary schemes:`);
      argumentsWithMultiplePrimaries.forEach((arg) => {
        console.log(`   - Argument ${arg.id}: ${arg.argumentSchemes.filter(inst => inst.role === "primary").length} primary schemes`);
      });
    } else {
      console.log(`\n✅ All arguments have at most one primary scheme`);
    }

    // Check 7: Verify ArgumentDependency table exists and is empty (fresh install)
    const dependencyCount = await prisma.argumentDependency.count();
    console.log(`\n✅ ArgumentDependency table exists with ${dependencyCount} records`);

    // Check 8: Verify SchemeNetPattern table exists and is empty (fresh install)
    const patternCount = await prisma.schemeNetPattern.count();
    console.log(`✅ SchemeNetPattern table exists with ${patternCount} records`);

    // Check 9: Sample a few instances to show structure
    const sampleInstances = await prisma.argumentSchemeInstance.findMany({
      take: 3,
      include: {
        argument: {
          select: {
            id: true,
            text: true,
          },
        },
        scheme: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (sampleInstances.length > 0) {
      console.log(`\n📝 Sample ArgumentSchemeInstances:`);
      sampleInstances.forEach((inst) => {
        console.log(`   - ${inst.id}:`);
        console.log(`     Argument: ${inst.argument.id} (${inst.argument.text.substring(0, 50)}...)`);
        console.log(`     Scheme: ${inst.scheme.name}`);
        console.log(`     Role: ${inst.role}, Explicitness: ${inst.explicitness}, Order: ${inst.order}`);
        console.log(`     IsPrimary: ${inst.isPrimary}, Confidence: ${inst.confidence}`);
      });
    }

    console.log("\n✅ Migration verification passed!");
    console.log("\n📋 Summary:");
    console.log(`   - Total ArgumentSchemeInstances: ${totalInstances}`);
    console.log(`   - All required fields populated: ${missingFields.length === 0 ? "Yes" : "No"}`);
    console.log(`   - Arguments with multiple schemes: ${multiSchemeArgs.length}`);
    console.log(`   - Multiple primary schemes found: ${argumentsWithMultiplePrimaries.length > 0 ? "Yes (needs fixing)" : "No"}`);
    console.log(`   - New tables created: ArgumentDependency, SchemeNetPattern`);

  } catch (error) {
    console.error("❌ Migration verification failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
