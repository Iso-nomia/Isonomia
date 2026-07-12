/**
 * Seed Script: Semantic Cluster Metadata
 * 
 * Populates the semanticCluster field for ArgumentScheme records
 * based on the cluster definitions in lib/schemes/semantic-clusters.ts
 * 
 * Week 6, Task 6.5: Enhance Scheme Metadata
 */

import { PrismaClient } from "@prisma/client";
import { semanticClusters } from "../lib/schemes/semantic-clusters";

const prisma = new PrismaClient();

async function main() {
  console.log("🎯 Seeding Semantic Cluster metadata for ArgumentScheme...\n");

  const allSchemes = await prisma.argumentScheme.findMany({
    select: { id: true, key: true, name: true },
  });

  console.log(`Found ${allSchemes.length} total schemes in database\n`);

  // Build mapping from scheme key to cluster ID
  const schemeToCluster: Record<string, string> = {};
  for (const [clusterId, cluster] of Object.entries(semanticClusters)) {
    for (const schemeKey of cluster.schemeKeys) {
      schemeToCluster[schemeKey] = clusterId;
    }
  }

  let updatedCount = 0;
  let alreadySetCount = 0;
  let notClassifiedCount = 0;

  for (const scheme of allSchemes) {
    const clusterId = schemeToCluster[scheme.key];

    if (!clusterId) {
      console.log(`⚠ Not classified: ${scheme.key}`);
      notClassifiedCount++;
      continue;
    }

    const cluster = semanticClusters[clusterId];

    // Check if already set
    const existing = await prisma.argumentScheme.findUnique({
      where: { id: scheme.id },
      select: { semanticCluster: true },
    });

    if (existing?.semanticCluster === clusterId) {
      console.log(`→ Already set: ${scheme.key} → ${cluster.name}`);
      alreadySetCount++;
      continue;
    }

    // Update the scheme
    await prisma.argumentScheme.update({
      where: { id: scheme.id },
      data: {
        semanticCluster: clusterId,
      },
    });

    console.log(`✓ ${scheme.key} → ${cluster.name}`);
    updatedCount++;
  }

  console.log(`\nSummary:`);
  console.log(`  ✓ Updated: ${updatedCount} schemes`);
  console.log(`  → Already set: ${alreadySetCount} schemes`);
  console.log(`  ⚠ Not classified: ${notClassifiedCount} schemes`);
  console.log(`  Total: ${allSchemes.length} schemes`);

  console.log("\n✅ Seeding complete!");

  // Show cluster statistics
  console.log("\n📊 Cluster Distribution:");
  const clusterCounts: Record<string, number> = {};
  for (const [clusterId, cluster] of Object.entries(semanticClusters)) {
    const count = cluster.schemeKeys.length;
    clusterCounts[clusterId] = count;
    console.log(`  ${cluster.icon} ${cluster.name}: ${count} schemes`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
