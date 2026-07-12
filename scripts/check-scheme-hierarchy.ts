/**
 * Check scheme hierarchy in database
 * Verify which schemes have parent-child relationships
 */

import { prisma } from "@/lib/prismaclient";

async function main() {
  console.log("\n🔍 Checking Scheme Hierarchy in Database\n");
  console.log("=".repeat(70));
  
  // Get all schemes with parentSchemeId
  const schemesWithParents = await prisma.argumentScheme.findMany({
    where: {
      parentSchemeId: { not: null },
    } as any,
    select: {
      id: true,
      key: true,
      name: true,
      parentSchemeId: true,
      clusterTag: true,
    } as any,
  }) as any[];
  
  console.log(`\n📊 Schemes with parent relationships: ${schemesWithParents.length}`);
  
  if (schemesWithParents.length > 0) {
    console.log("\nHierarchy Structure:");
    for (const scheme of schemesWithParents) {
      console.log(`\n  Child: ${scheme.key}`);
      console.log(`    ID: ${scheme.id}`);
      console.log(`    Name: ${scheme.name || "N/A"}`);
      console.log(`    Parent ID: ${scheme.parentSchemeId}`);
      console.log(`    Cluster: ${scheme.clusterTag || "N/A"}`);
      
      // Find parent
      const parent = await prisma.argumentScheme.findUnique({
        where: { id: scheme.parentSchemeId },
        select: { key: true, name: true },
      });
      
      if (parent) {
        console.log(`    Parent: ${parent.key} (${parent.name || "N/A"})`);
      }
    }
  } else {
    console.log("\n⚠️  No parent-child relationships found in database.");
    console.log("   Hierarchy export will work but won't produce isSubtypeOf triples.");
  }
  
  // Count schemes by cluster
  console.log("\n" + "=".repeat(70));
  console.log("\n📦 Schemes by Cluster Tag:\n");
  
  const allSchemes = await prisma.argumentScheme.findMany({
    select: {
      key: true,
      clusterTag: true,
    } as any,
  }) as any[];
  
  const clusterMap = new Map<string, string[]>();
  for (const scheme of allSchemes) {
    if (scheme.clusterTag) {
      if (!clusterMap.has(scheme.clusterTag)) {
        clusterMap.set(scheme.clusterTag, []);
      }
      clusterMap.get(scheme.clusterTag)!.push(scheme.key);
    }
  }
  
  for (const [cluster, schemes] of clusterMap.entries()) {
    console.log(`  ${cluster}: ${schemes.length} schemes`);
    schemes.forEach(key => console.log(`    - ${key}`));
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("\n✅ Hierarchy check complete\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
