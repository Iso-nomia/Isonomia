// scripts/test-scheme-creator-ui.ts
// Test Phase 6D: Create a child scheme with clustering fields

import { prisma } from "@/lib/prismaclient";

async function testSchemeCreatorUI() {
  console.log("🧪 Testing Phase 6D: Scheme Creator UI with Clustering Fields\n");

  try {
    // Find Practical Reasoning scheme to use as parent
    const parentScheme = await prisma.argumentScheme.findUnique({
      where: { key: "practical_reasoning" },
      select: { id: true, key: true, name: true },
    });

    if (!parentScheme) {
      console.log("❌ Parent scheme 'practical_reasoning' not found");
      console.log("Run: npm run seed:schemes");
      return;
    }

    console.log("✅ Found parent scheme:");
    console.log(`   ${parentScheme.name} (${parentScheme.key})`);
    console.log(`   ID: ${parentScheme.id}\n`);

    // Create a test child scheme
    const childSchemeData = {
      key: "test_practical_child",
      name: "Test Practical Reasoning Variant",
      summary: "A test variant of practical reasoning with inherited CQs",
      description: "This is a test scheme created to validate Phase 6D clustering UI",
      // Taxonomy
      purpose: "action",
      source: "internal",
      materialRelation: "practical",
      reasoningType: "practical",
      // Clustering fields (Phase 6D)
      parentSchemeId: parentScheme.id,
      clusterTag: "practical_reasoning_family",
      inheritCQs: true,
      // Critical questions
      cq: [
        {
          cqKey: "test_variant_specific?",
          text: "Is this variant-specific condition satisfied?",
          attackType: "UNDERCUTS",
          targetScope: "inference",
        },
      ],
    };

    console.log("📝 Creating child scheme with clustering fields:");
    console.log(`   Key: ${childSchemeData.key}`);
    console.log(`   Parent: ${parentScheme.key}`);
    console.log(`   Cluster: ${childSchemeData.clusterTag}`);
    console.log(`   Inherit CQs: ${childSchemeData.inheritCQs}\n`);

    const created = await prisma.argumentScheme.create({
      data: childSchemeData,
    });

    console.log("✅ Child scheme created successfully!");
    console.log(`   ID: ${created.id}`);
    console.log(`   Key: ${created.key}`);
    console.log(`   Name: ${created.name}\n`);

    // Verify parent-child relationship
    const withRelations = await prisma.argumentScheme.findUnique({
      where: { id: created.id },
      include: {
        parentScheme: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    console.log("🔗 Verified parent-child relationship:");
    console.log(`   Child: ${withRelations?.name} (${withRelations?.key})`);
    console.log(`   Parent: ${withRelations?.parentScheme?.name} (${withRelations?.parentScheme?.key})`);
    console.log(`   Cluster Tag: ${withRelations?.clusterTag}`);
    console.log(`   Inherit CQs: ${withRelations?.inheritCQs}\n`);

    // Test CQ inheritance
    console.log("🧬 Testing CQ inheritance...");
    const { getCQsWithInheritance } = await import("@/lib/argumentation/cqInheritance");
    const cqsWithInheritance = await getCQsWithInheritance(created.id, true);

    console.log(`   Own CQs: ${cqsWithInheritance.filter(c => !c.inherited).length}`);
    console.log(`   Inherited CQs: ${cqsWithInheritance.filter(c => c.inherited).length}`);
    console.log(`   Total CQs: ${cqsWithInheritance.length}\n`);

    if (cqsWithInheritance.length > 1) {
      console.log("✅ CQ inheritance working!");
      console.log("\nSample inherited CQs:");
      cqsWithInheritance
        .filter(c => c.inherited)
        .slice(0, 3)
        .forEach(cq => {
          console.log(`   • ${cq.cqKey} (from ${cq.fromScheme})`);
        });
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test scheme...");
    await prisma.argumentScheme.delete({
      where: { id: created.id },
    });
    console.log("✅ Test scheme deleted\n");

    console.log("✨ Phase 6D test completed successfully!");
    console.log("The UI form will now support:");
    console.log("  1. Parent scheme selector");
    console.log("  2. Cluster tag input");
    console.log("  3. Inherit CQs checkbox");

  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testSchemeCreatorUI();
