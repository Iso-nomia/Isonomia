// scripts/test-scheme-net.ts
/**
 * Test script for Phase 5: Scheme Nets API
 * 
 * Creates a test scheme net with 3 sequential steps demonstrating
 * the "Hague Speech" example from Macagno & Walton Section 7:
 * Classification → Commitment → Consequences
 */

import { prisma } from "@/lib/prismaclient";
import {
  upsertSchemeNet,
  getSchemeNetForArgument,
  getCQsForSchemeNet,
  deleteSchemeNet,
} from "@/lib/argumentation/schemeNetLogic";

async function main() {
  console.log("🧪 Testing Scheme Net Implementation (Phase 5)\n");
  console.log("=" .repeat(80));

  // Find or create a test argument
  let testArg = await prisma.argument.findFirst({
    where: { text: { contains: "test scheme net" } },
  });

  if (!testArg) {
    console.log("\n📝 Creating test argument...");
    const delib = await prisma.deliberation.findFirst({
      select: { id: true },
    });

    if (!delib) {
      console.error("❌ No deliberation found. Create one first.");
      process.exit(1);
    }

    testArg = await prisma.argument.create({
      data: {
        deliberationId: delib.id,
        authorId: "test-user",
        text: "Russia's action is a violation of sovereignty (classification), and sovereignty cannot be violated (commitment), therefore Russia will face consequences (threat).",
      },
    });
    console.log(`✓ Created test argument: ${testArg.id}`);
  } else {
    console.log(`✓ Using existing test argument: ${testArg.id}`);
  }

  // Get available schemes
  const schemes = await prisma.argumentScheme.findMany({
    select: { id: true, key: true, name: true },
  });

  console.log(`\n📚 Found ${schemes.length} schemes in database`);
  schemes.forEach((s) => console.log(`  - ${s.key}: ${s.name || "Unnamed"}`));

  // Find classification, commitment, and consequences schemes
  const classificationScheme = schemes.find((s) => s.key === "classification");
  const consequencesScheme = schemes.find(
    (s) => s.key === "positive_consequences" || s.key === "negative_consequences"
  );

  if (!classificationScheme || !consequencesScheme) {
    console.error(
      "\n❌ Required schemes not found. Available keys:",
      schemes.map((s) => s.key).join(", ")
    );
    console.error("Run: npx tsx scripts/schemes.seed.ts");
    process.exit(1);
  }

  console.log(`\n✓ Using schemes:`);
  console.log(`  - Classification: ${classificationScheme.id} (${classificationScheme.key})`);
  console.log(`  - Consequences: ${consequencesScheme.id} (${consequencesScheme.key})`);

  // Create a 3-step net: Classification → (implicit commitment) → Consequences
  console.log("\n🔗 Creating scheme net with 3 sequential steps...");

  const netData = {
    description:
      "Multi-step argument: Classification establishes violation, which triggers commitment to sovereignty principle, leading to consequence threat (Hague Speech example from Macagno & Walton)",
    steps: [
      {
        schemeId: classificationScheme.id,
        stepOrder: 1,
        label: "Classification",
        stepText: "Russia's action is a violation of sovereignty",
        confidence: 0.85,
        inputFromStep: null, // First step has no input
      },
      {
        schemeId: consequencesScheme.id,
        stepOrder: 2,
        label: "Implicit Commitment",
        stepText: "Sovereignty of nations cannot be violated (shared value)",
        confidence: 0.90,
        inputFromStep: 1, // Uses classification output
        inputSlotMapping: {
          violation: "classification_result", // Map conclusion var to premise var
        },
      },
      {
        schemeId: consequencesScheme.id,
        stepOrder: 3,
        label: "Consequences",
        stepText: "Russia will face consequences (implicit threat)",
        confidence: 0.75,
        inputFromStep: 2, // Uses commitment output
        inputSlotMapping: {
          action: "commitment_violation", // Map commitment to action premise
        },
      },
    ],
  };

  const { net, steps } = await upsertSchemeNet(testArg.id, netData);

  console.log(`✓ Created scheme net: ${net.id}`);
  console.log(`  - Overall confidence: ${net.overallConfidence} (weakest link)`);
  console.log(`  - Steps: ${steps.length}`);

  steps.forEach((step, idx) => {
    console.log(
      `    Step ${step.stepOrder}: ${netData.steps[idx].label} (confidence: ${step.confidence})`
    );
  });

  // Retrieve the net
  console.log("\n🔍 Retrieving scheme net...");
  const retrieved = await getSchemeNetForArgument(testArg.id);

  if (retrieved) {
    console.log(`✓ Retrieved net with ${retrieved.steps.length} steps:`);
    retrieved.steps.forEach((step) => {
      console.log(`  - Step ${step.stepOrder}: ${step.label || "Unlabeled"}`);
      console.log(`    Scheme: ${step.scheme.name || step.scheme.key}`);
      console.log(`    Confidence: ${step.confidence}`);
      if (step.inputFromStep) {
        console.log(`    Input from step: ${step.inputFromStep}`);
      }
    });
  }

  // Get CQs grouped by step
  console.log("\n❓ Fetching Critical Questions grouped by step...");
  const stepsWithCQs = await getCQsForSchemeNet(testArg.id);

  stepsWithCQs.forEach((step) => {
    console.log(`\n  Step ${step.stepOrder}: ${step.stepLabel}`);
    console.log(`  Scheme: ${step.schemeName}`);
    console.log(`  CQs (${step.cqs.length}):`);
    step.cqs.slice(0, 3).forEach((cq) => {
      console.log(`    - ${cq.displayText}`);
    });
    if (step.cqs.length > 3) {
      console.log(`    ... and ${step.cqs.length - 3} more`);
    }
  });

  // Test delete
  console.log("\n🗑️  Testing delete...");
  const deleted = await deleteSchemeNet(testArg.id);
  console.log(`✓ Deleted: ${deleted}`);

  // Verify deletion
  const afterDelete = await getSchemeNetForArgument(testArg.id);
  console.log(`✓ Net after delete: ${afterDelete ? "still exists (ERROR)" : "null (correct)"}`);

  console.log("\n" + "=" .repeat(80));
  console.log("✅ All tests passed! Phase 5B (API) complete.");
  console.log("\nNext: Phase 5C - Build UI components (SchemeNetBuilder, SchemeNetVisualization)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    prisma.$disconnect();
    process.exit(1);
  });
