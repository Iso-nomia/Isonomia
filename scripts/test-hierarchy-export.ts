/**
 * Test Phase 8E.3: Hierarchy Export
 * 
 * Tests:
 * 1. Export scheme with parent (should have aif:isSubtypeOf triple)
 * 2. Export scheme with grandparent (should have transitive mesh:hasAncestor triples)
 * 3. Export entire hierarchy cluster
 * 4. Verify hierarchy triples are correct
 * 
 * Usage: npx tsx scripts/test-hierarchy-export.ts
 */

import { prisma } from "@/lib/prismaclient";
import { exportSchemeToAIF, exportClusterFamily } from "@/lib/aif/aifExporter";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "test-output", "hierarchy-export");

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function saveResult(filename: string, content: string) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, content, "utf-8");
  console.log(`   ✅ Saved to: ${filepath}`);
}

/**
 * Test 1: Export scheme with direct parent
 */
async function testSchemeWithParent() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: Export Scheme with Parent (value_based_pr)");
  console.log("=".repeat(70));
  
  // value_based_pr has parent: practical_reasoning
  const result = await exportSchemeToAIF("cmgms5x4o000fg1wizwfqnp9q", {
    format: "turtle",
    includeHierarchy: true,
    includeCQs: false, // Focus on hierarchy
    includeMeshExtensions: true,
  });
  
  if (result.success && result.data) {
    console.log(`\n✅ Export successful`);
    console.log(`   Triples: ${result.metadata.tripleCount}`);
    
    saveResult("child-scheme.ttl", result.data);
    
    // Check for hierarchy triples
    if (result.data.includes("aif:isSubtypeOf")) {
      console.log(`   ✅ Found aif:isSubtypeOf triple (direct parent link)`);
      
      // Extract the parent URI
      const match = result.data.match(/aif:isSubtypeOf\s+<([^>]+)>/);
      if (match) {
        console.log(`   Parent URI: ${match[1]}`);
      }
    } else {
      console.log(`   ❌ Missing aif:isSubtypeOf triple!`);
    }
    
    if (result.data.includes("mesh:hasAncestor")) {
      console.log(`   ✅ Found mesh:hasAncestor triple (transitive ancestor)`);
    } else {
      console.log(`   ℹ️  No mesh:hasAncestor triples (expected for 1-level hierarchy)`);
    }
  } else {
    console.log(`   ❌ Export failed: ${result.error?.message}`);
  }
}

/**
 * Test 2: Export scheme with grandparent (2-level hierarchy)
 */
async function testSchemeWithGrandparent() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 2: Export Scheme with Grandparent (slippery_slope)");
  console.log("=".repeat(70));
  
  // slippery_slope -> negative_consequences -> practical_reasoning
  const result = await exportSchemeToAIF("cmgms5zrq000jg1wik53dqjih", {
    format: "turtle",
    includeHierarchy: true,
    includeCQs: false,
    includeMeshExtensions: true,
  });
  
  if (result.success && result.data) {
    console.log(`\n✅ Export successful`);
    console.log(`   Triples: ${result.metadata.tripleCount}`);
    
    saveResult("grandchild-scheme.ttl", result.data);
    
    // Check for direct parent
    if (result.data.includes("aif:isSubtypeOf")) {
      console.log(`   ✅ Found aif:isSubtypeOf (direct parent: negative_consequences)`);
    }
    
    // Check for transitive ancestors
    const ancestorMatches = result.data.match(/mesh:hasAncestor/g);
    if (ancestorMatches) {
      console.log(`   ✅ Found ${ancestorMatches.length} mesh:hasAncestor triples`);
      console.log(`   Expected ancestors: negative_consequences, practical_reasoning`);
      
      // Show ancestor URIs
      const ancestorLines = result.data.split("\n").filter(l => l.includes("mesh:hasAncestor"));
      ancestorLines.forEach(line => console.log(`   ${line.trim()}`));
    } else {
      console.log(`   ❌ Missing mesh:hasAncestor triples!`);
    }
  } else {
    console.log(`   ❌ Export failed: ${result.error?.message}`);
  }
}

/**
 * Test 3: Export entire cluster with mixed hierarchy
 */
async function testClusterWithHierarchy() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 3: Export Cluster with Hierarchy (practical_reasoning_family)");
  console.log("=".repeat(70));
  
  const result = await exportClusterFamily("practical_reasoning_family", {
    format: "turtle",
    includeHierarchy: true,
    includeCQs: false, // Focus on hierarchy structure
    includeMeshExtensions: true,
  });
  
  if (result.success && result.data) {
    console.log(`\n✅ Export successful`);
    console.log(`   Schemes: ${result.metadata.schemeCount}`);
    console.log(`   Triples: ${result.metadata.tripleCount}`);
    
    saveResult("cluster-hierarchy.ttl", result.data);
    
    // Count hierarchy triples
    const subtypeCount = (result.data.match(/aif:isSubtypeOf/g) || []).length;
    const ancestorCount = (result.data.match(/mesh:hasAncestor/g) || []).length;
    
    console.log(`\n📊 Hierarchy Statistics:`);
    console.log(`   aif:isSubtypeOf triples: ${subtypeCount}`);
    console.log(`   mesh:hasAncestor triples: ${ancestorCount}`);
    
    console.log(`\n🔗 Expected Hierarchy:`);
    console.log(`   practical_reasoning (root)`);
    console.log(`   ├── value_based_pr`);
    console.log(`   ├── positive_consequences`);
    console.log(`   └── negative_consequences`);
    console.log(`       └── slippery_slope`);
    
    console.log(`\n📝 Expected Triples:`);
    console.log(`   value_based_pr aif:isSubtypeOf practical_reasoning`);
    console.log(`   value_based_pr mesh:hasAncestor practical_reasoning`);
    console.log(`   positive_consequences aif:isSubtypeOf practical_reasoning`);
    console.log(`   positive_consequences mesh:hasAncestor practical_reasoning`);
    console.log(`   negative_consequences aif:isSubtypeOf practical_reasoning`);
    console.log(`   negative_consequences mesh:hasAncestor practical_reasoning`);
    console.log(`   slippery_slope aif:isSubtypeOf negative_consequences`);
    console.log(`   slippery_slope mesh:hasAncestor negative_consequences`);
    console.log(`   slippery_slope mesh:hasAncestor practical_reasoning`);
  } else {
    console.log(`   ❌ Export failed: ${result.error?.message}`);
  }
}

/**
 * Test 4: Visual inspection of hierarchy triples
 */
async function inspectHierarchyTriples() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 4: Inspect Hierarchy Triples in Detail");
  console.log("=".repeat(70));
  
  const result = await exportSchemeToAIF("cmgms5zrq000jg1wik53dqjih", {
    format: "turtle",
    includeHierarchy: true,
    includeCQs: false,
    includeMeshExtensions: false,
  });
  
  if (result.success && result.data) {
    console.log(`\n📄 Hierarchy Triples for slippery_slope:\n`);
    
    const lines = result.data.split("\n");
    let inSchemeBlock = false;
    
    for (const line of lines) {
      if (line.includes("slippery_slope")) {
        inSchemeBlock = true;
      }
      
      if (inSchemeBlock && (line.includes("isSubtypeOf") || line.includes("hasAncestor"))) {
        console.log(`   ${line.trim()}`);
      }
      
      if (inSchemeBlock && line.trim() === ".") {
        break; // End of scheme block
      }
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║            PHASE 8E.3: HIERARCHY EXPORT TEST SUITE                 ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");
  
  ensureOutputDir();
  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  
  try {
    await testSchemeWithParent();
    await testSchemeWithGrandparent();
    await testClusterWithHierarchy();
    await inspectHierarchyTriples();
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ ALL HIERARCHY TESTS COMPLETED");
    console.log("=".repeat(70));
    console.log(`\n📁 Check output files in: ${OUTPUT_DIR}`);
    console.log("\nNext Steps:");
    console.log("  1. Inspect generated RDF files for hierarchy triples");
    console.log("  2. Verify aif:isSubtypeOf links to direct parents");
    console.log("  3. Verify mesh:hasAncestor includes all ancestors");
    console.log("  4. Test API endpoints with includeHierarchy=true");
    
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
