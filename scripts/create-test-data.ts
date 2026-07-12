// scripts/create-test-data.ts
/**
 * Create test data for Gap 4 endpoints
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTestData() {
  console.log("🏗️  Creating test data for Gap 4\n");

  try {
    // Find or create deliberation
    let deliberation = await prisma.deliberation.findFirst({
      select: { id: true, title: true }
    });

    if (!deliberation) {
      console.log("Creating deliberation...");
      deliberation = await prisma.deliberation.create({
        data: {
          title: "Test Deliberation for Gap 4",
          createdById: "test-user"
        },
        select: { id: true, title: true }
      });
    }

    console.log(`✅ Deliberation: ${deliberation.title} (${deliberation.id})\n`);

    // Find argument with ArgumentSupport
    const support = await prisma.argumentSupport.findFirst({
      select: { id: true, argumentId: true, claimId: true }
    });

    if (!support) {
      console.log("❌ No ArgumentSupport found. Cannot create test data.");
      return;
    }

    const argument = await prisma.argument.findUnique({
      where: { id: support.argumentId },
      select: { id: true, text: true, deliberationId: true }
    });

    console.log(`✅ Argument: ${argument?.text?.substring(0, 50)}...`);
    console.log(`✅ Derivation: ${support.id}\n`);

    // Create 3 test assumptions
    console.log("Creating test assumptions...\n");

    const assumptions = [];
    for (let i = 1; i <= 3; i++) {
      const assumption = await prisma.assumptionUse.create({
        data: {
          deliberationId: argument!.deliberationId,
          argumentId: support.argumentId,
          assumptionText: `Test Assumption ${i}: This is a sample assumption for testing Gap 4 endpoints.`,
          role: ["premise", "warrant", "value"][i - 1],
          weight: 0.5 + (i * 0.1),
          status: "ACCEPTED"
        }
      });
      assumptions.push(assumption);
      console.log(`   ✅ Created assumption ${i}: ${assumption.id}`);
    }

    // Link assumptions to derivation
    console.log("\nLinking assumptions to derivation...\n");

    for (let i = 0; i < assumptions.length; i++) {
      const link = await prisma.derivationAssumption.create({
        data: {
          derivationId: support.id,
          assumptionId: assumptions[i].id,
          weight: 0.6 + (i * 0.15),
          inferredFrom: i === 2 ? support.id : null // Make last one "transitive"
        }
      });
      console.log(`   ✅ Linked assumption ${i + 1} (weight: ${link.weight})`);
    }

    // Create one more ArgumentSupport for the same argument
    console.log("\nCreating second derivation for same argument...\n");

    const support2 = await prisma.argumentSupport.create({
      data: {
        argumentId: support.argumentId,
        claimId: support.claimId,
        kind: "deductive",
        label: "Test derivation 2"
      }
    });

    console.log(`✅ Second derivation: ${support2.id}`);

    // Link first 2 assumptions to second derivation
    for (let i = 0; i < 2; i++) {
      await prisma.derivationAssumption.create({
        data: {
          derivationId: support2.id,
          assumptionId: assumptions[i].id,
          weight: 0.8
        }
      });
      console.log(`   ✅ Linked assumption ${i + 1} to second derivation`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Test data created successfully!\n");
    console.log("Test IDs:");
    console.log(`  Deliberation: ${deliberation.id}`);
    console.log(`  Argument:     ${support.argumentId}`);
    console.log(`  Derivation 1: ${support.id}`);
    console.log(`  Derivation 2: ${support2.id}`);
    console.log(`  Assumptions:  ${assumptions.map(a => a.id).join(", ")}`);
    console.log("");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
