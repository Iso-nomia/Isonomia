/**
 * Phase 6A: Seed Scheme Hierarchies
 * 
 * Establishes parent-child relationships between schemes based on
 * Macagno & Walton Section 6: Scheme Clustering & Family Resemblances
 * 
 * Key Hierarchies:
 * 1. Practical Reasoning Family
 *    - Basic PR (root)
 *    - Value-Based PR (child of PR)
 *    - Slippery Slope (child of Neg Consequences OR VBPR)
 *    - Positive/Negative Consequences (children of PR)
 * 
 * 2. Authority Family
 *    - Expert Opinion (root)
 *    - Witness Testimony (child)
 *    - Position to Know (child)
 * 
 * 3. Similarity Family
 *    - Analogy (root)
 *    - Precedent (child)
 *    - Example (child)
 */

import { prisma } from "@/lib/prismaclient";

type SchemeHierarchy = {
  parentKey: string;
  childKey: string;
  clusterTag: string;
  inheritCQs: boolean;
};

const HIERARCHIES: SchemeHierarchy[] = [
  // Practical Reasoning Family
  {
    parentKey: "practical_reasoning",
    childKey: "value_based_pr",
    clusterTag: "practical_reasoning_family",
    inheritCQs: true,
  },
  {
    parentKey: "practical_reasoning",
    childKey: "positive_consequences",
    clusterTag: "practical_reasoning_family",
    inheritCQs: true,
  },
  {
    parentKey: "practical_reasoning",
    childKey: "negative_consequences",
    clusterTag: "practical_reasoning_family",
    inheritCQs: true,
  },
  {
    parentKey: "negative_consequences",
    childKey: "slippery_slope",
    clusterTag: "practical_reasoning_family",
    inheritCQs: true,
  },
  
  // Note: Slippery Slope is complex - it's a subtype of BOTH
  // Negative Consequences AND Value-Based PR in Macagno & Walton.
  // We model the primary relationship (Neg Consequences) here.
  // The secondary relationship (VBPR) is captured via clusterTag.
];

async function main() {
  console.log("🌳 Seeding Scheme Hierarchies (Phase 6A)\n");
  console.log("Based on Macagno & Walton Section 6: Scheme Clustering\n");
  console.log("=" .repeat(80));

  // First, set cluster tags on root schemes
  const rootSchemes = [
    { key: "practical_reasoning", tag: "practical_reasoning_family" },
    { key: "expert_opinion", tag: "authority_family" },
    { key: "analogy", tag: "similarity_family" },
    { key: "causal", tag: "causal_family" },
    { key: "classification", tag: "definition_family" },
  ];

  console.log("\n📌 Setting cluster tags on root schemes...");
  for (const { key, tag } of rootSchemes) {
    const scheme = await prisma.argumentScheme.findUnique({
      where: { key },
      select: { id: true, name: true },
    });

    if (scheme) {
      await prisma.argumentScheme.update({
        where: { key },
        data: { clusterTag: tag },
      });
      console.log(`  ✓ ${scheme.name || key}: ${tag}`);
    } else {
      console.log(`  ⚠ Scheme "${key}" not found, skipping`);
    }
  }

  // Establish parent-child relationships
  console.log("\n🔗 Establishing parent-child relationships...");
  
  let successCount = 0;
  let skipCount = 0;

  for (const { parentKey, childKey, clusterTag, inheritCQs } of HIERARCHIES) {
    const parent = await prisma.argumentScheme.findUnique({
      where: { key: parentKey },
      select: { id: true, name: true },
    });

    const child = await prisma.argumentScheme.findUnique({
      where: { key: childKey },
      select: { id: true, name: true },
    });

    if (!parent) {
      console.log(`  ⚠ Parent scheme "${parentKey}" not found, skipping`);
      skipCount++;
      continue;
    }

    if (!child) {
      console.log(`  ⚠ Child scheme "${childKey}" not found, skipping`);
      skipCount++;
      continue;
    }

    // Update child to reference parent
    await prisma.argumentScheme.update({
      where: { key: childKey },
      data: {
        parentSchemeId: parent.id,
        clusterTag,
        inheritCQs,
      },
    });

    console.log(
      `  ✓ ${child.name || childKey} → parent: ${parent.name || parentKey}`
    );
    console.log(`    Cluster: ${clusterTag}, Inherit CQs: ${inheritCQs}`);
    successCount++;
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log(`\n✅ Hierarchy seeding complete!`);
  console.log(`   - ${successCount} relationships established`);
  console.log(`   - ${skipCount} relationships skipped (schemes not found)`);

  // Display hierarchy tree
  console.log("\n🌳 Resulting Hierarchy Tree:\n");

  const allSchemes = await prisma.argumentScheme.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      parentSchemeId: true,
      childSchemes: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
      clusterTag: true,
    },
  });

  // Find root schemes (no parent)
  const roots = allSchemes.filter((s) => !s.parentSchemeId);

  function printTree(scheme: typeof allSchemes[0], depth: number = 0) {
    const indent = "  ".repeat(depth);
    const tag = scheme.clusterTag ? ` [${scheme.clusterTag}]` : "";
    console.log(`${indent}├─ ${scheme.name || scheme.key}${tag}`);

    for (const child of scheme.childSchemes) {
      const fullChild = allSchemes.find((s) => s.id === child.id);
      if (fullChild) {
        printTree(fullChild, depth + 1);
      }
    }
  }

  // Print each cluster
  const clusters = new Set(allSchemes.map((s) => s.clusterTag).filter(Boolean));
  for (const cluster of clusters) {
    console.log(`\n${cluster}:`);
    const clusterRoots = roots.filter((s) => s.clusterTag === cluster);
    clusterRoots.forEach((root) => printTree(root, 0));
  }

  // Show orphaned schemes (no cluster tag)
  const orphans = allSchemes.filter((s) => !s.clusterTag && !s.parentSchemeId);
  if (orphans.length > 0) {
    console.log("\n\nOrphaned schemes (no cluster):");
    orphans.forEach((s) => console.log(`  - ${s.name || s.key}`));
  }

  console.log("\n" + "=".repeat(80));
  console.log("\nNext: Run Phase 6B to implement CQ inheritance logic");
  console.log("See: lib/argumentation/cqGeneration.ts\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Error seeding hierarchies:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
