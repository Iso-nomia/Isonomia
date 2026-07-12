/**
 * Test script for AIF Export functionality (Phase 8E.2)
 * 
 * Tests:
 * 1. Single scheme export in all 3 formats (RDF/XML, Turtle, JSON-LD)
 * 2. Cluster family export
 * 3. Export with/without CQs and hierarchy
 * 4. Output validation and structure inspection
 * 
 * Usage: npx tsx scripts/test-aif-export.ts
 */

import { prisma } from "@/lib/prismaclient";
import {
  exportSchemeToAIF,
  exportSchemeByKey,
  exportClusterFamily,
  exportAllSchemes,
} from "@/lib/aif/aifExporter";
import * as fs from "fs";
import * as path from "path";

// Output directory for test results
const OUTPUT_DIR = path.join(process.cwd(), "test-output", "aif-export");

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Save export result to file
 */
function saveResult(filename: string, content: string) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, content, "utf-8");
  console.log(`   ✅ Saved to: ${filepath}`);
}

/**
 * Print export metadata
 */
function printMetadata(result: any) {
  if (result.success) {
    console.log(`   📊 Schemes: ${result.metadata.schemeCount}`);
    console.log(`   ❓ Questions: ${result.metadata.questionCount}`);
    console.log(`   🔗 Triples: ${result.metadata.tripleCount}`);
    console.log(`   📅 Exported: ${result.metadata.exportedAt.toISOString()}`);
  } else {
    console.log(`   ❌ Error: ${result.error?.message}`);
    if (result.error?.details) {
      console.log(`   Details: ${JSON.stringify(result.error.details, null, 2)}`);
    }
  }
}

/**
 * Validate RDF structure (basic checks)
 */
function validateRDF(format: string, data: string): boolean {
  console.log(`   🔍 Validating ${format} structure...`);
  
  switch (format) {
    case "rdfxml":
      // Check for RDF/XML structure
      if (!data.includes('<?xml') || !data.includes('rdf:RDF')) {
        console.log(`   ❌ Invalid RDF/XML: Missing XML declaration or rdf:RDF root`);
        return false;
      }
      if (!data.includes('xmlns:aif=') || !data.includes('xmlns:mesh=')) {
        console.log(`   ⚠️  Warning: Missing AIF or Mesh namespace declarations`);
      }
      console.log(`   ✅ RDF/XML structure valid`);
      return true;
      
    case "turtle":
      // Check for Turtle structure
      if (!data.includes('@prefix aif:') || !data.includes('@prefix mesh:')) {
        console.log(`   ❌ Invalid Turtle: Missing namespace prefixes`);
        return false;
      }
      console.log(`   ✅ Turtle structure valid`);
      return true;
      
    case "jsonld":
      // Check for JSON-LD structure
      try {
        const json = JSON.parse(data);
        if (!json["@context"] || !json["@graph"]) {
          console.log(`   ❌ Invalid JSON-LD: Missing @context or @graph`);
          return false;
        }
        console.log(`   ✅ JSON-LD structure valid`);
        return true;
      } catch (err) {
        console.log(`   ❌ Invalid JSON-LD: Not valid JSON`);
        return false;
      }
      
    default:
      return false;
  }
}

/**
 * Test 1: Single scheme export in all formats
 */
async function testSingleSchemeExport() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: Single Scheme Export (All Formats)");
  console.log("=".repeat(70));
  
  // Find a scheme to test with (preferably with CQs)
  const scheme = await prisma.argumentScheme.findFirst({
    where: {
      key: "practical_reasoning", // Try common scheme first
    },
  });
  
  if (!scheme) {
    console.log("⚠️  Scheme 'practical_reasoning' not found, using first available scheme");
    const firstScheme = await prisma.argumentScheme.findFirst();
    if (!firstScheme) {
      console.log("❌ No schemes found in database!");
      return;
    }
    console.log(`\nUsing scheme: ${firstScheme.key} (${firstScheme.id})`);
  } else {
    console.log(`\nUsing scheme: ${scheme.key} (${scheme.id})`);
  }
  
  const testScheme = scheme || await prisma.argumentScheme.findFirst();
  if (!testScheme) return;
  
  const formats: Array<"rdfxml" | "turtle" | "jsonld"> = ["rdfxml", "turtle", "jsonld"];
  
  for (const format of formats) {
    console.log(`\n📝 Testing ${format.toUpperCase()} export...`);
    
    const result = await exportSchemeToAIF(testScheme.id, {
      format,
      includeCQs: true,
      includeHierarchy: true,
      includeMeshExtensions: true,
    });
    
    printMetadata(result);
    
    if (result.success && result.data) {
      const extension = format === "rdfxml" ? "xml" : format === "turtle" ? "ttl" : "jsonld";
      saveResult(`single-scheme.${extension}`, result.data);
      validateRDF(format, result.data);
    }
  }
}

/**
 * Test 2: Export by scheme key
 */
async function testExportByKey() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 2: Export by Scheme Key");
  console.log("=".repeat(70));
  
  const testKey = "practical_reasoning";
  console.log(`\n🔑 Exporting scheme with key: ${testKey}`);
  
  const result = await exportSchemeByKey(testKey, {
    format: "turtle",
    includeCQs: true,
    includeHierarchy: true,
  });
  
  printMetadata(result);
  
  if (result.success && result.data) {
    saveResult(`by-key-${testKey}.ttl`, result.data);
    validateRDF("turtle", result.data);
  }
}

/**
 * Test 3: Cluster family export
 */
async function testClusterExport() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 3: Cluster Family Export");
  console.log("=".repeat(70));
  
  // Find a scheme with a clusterTag (using type assertion for Phase 6 field)
  const schemeWithCluster = await prisma.argumentScheme.findFirst({
    where: {
      clusterTag: { not: null },
    } as any,
  }) as any;
  
  if (!schemeWithCluster || !schemeWithCluster.clusterTag) {
    console.log("⚠️  No schemes with clusterTag found, skipping cluster export test");
    return;
  }
  
  console.log(`\n📦 Exporting cluster: ${schemeWithCluster.clusterTag}`);
  
  const result = await exportClusterFamily(schemeWithCluster.clusterTag, {
    format: "turtle",
    includeCQs: true,
    includeHierarchy: true,
    includeMeshExtensions: true,
  });
  
  printMetadata(result);
  
  if (result.success && result.data) {
    saveResult(`cluster-${schemeWithCluster.clusterTag}.ttl`, result.data);
    validateRDF("turtle", result.data);
  }
}

/**
 * Test 4: Export without CQs
 */
async function testExportWithoutCQs() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 4: Export Without Critical Questions");
  console.log("=".repeat(70));
  
  const scheme = await prisma.argumentScheme.findFirst();
  if (!scheme) {
    console.log("❌ No schemes found!");
    return;
  }
  
  console.log(`\n📝 Exporting scheme without CQs: ${scheme.key}`);
  
  const result = await exportSchemeToAIF(scheme.id, {
    format: "turtle",
    includeCQs: false,
    includeHierarchy: false,
    includeMeshExtensions: false,
  });
  
  printMetadata(result);
  
  if (result.success && result.data) {
    saveResult(`no-cqs-${scheme.key}.ttl`, result.data);
    
    // Verify no CQ triples in output
    if (result.data.includes("aif:hasQuestion")) {
      console.log("   ⚠️  Warning: Found CQ triples despite includeCQs=false");
    } else {
      console.log("   ✅ Confirmed: No CQ triples in output");
    }
  }
}

/**
 * Test 5: Export all schemes (limited sample)
 */
async function testExportAll() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 5: Export All Schemes (Sample)");
  console.log("=".repeat(70));
  
  const count = await prisma.argumentScheme.count();
  console.log(`\n📊 Total schemes in database: ${count}`);
  
  if (count > 10) {
    console.log("⚠️  Large dataset detected. Skipping full export test.");
    console.log("   Use exportAllSchemes() function manually for full export.");
    return;
  }
  
  console.log("📝 Exporting all schemes...");
  
  const result = await exportAllSchemes({
    format: "turtle",
    includeCQs: true,
    includeHierarchy: true,
  });
  
  printMetadata(result);
  
  if (result.success && result.data) {
    saveResult(`all-schemes.ttl`, result.data);
    validateRDF("turtle", result.data);
  }
}

/**
 * Test 6: Inspect RDF structure details
 */
async function inspectRDFStructure() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 6: RDF Structure Inspection");
  console.log("=".repeat(70));
  
  const scheme = await prisma.argumentScheme.findFirst({
    include: {
      cqs: true,
    },
  }) as any;
  
  if (!scheme) {
    console.log("❌ No schemes found!");
    return;
  }
  
  console.log(`\n🔍 Inspecting RDF for scheme: ${scheme.key}`);
  console.log(`   Name: ${scheme.name || "N/A"}`);
  console.log(`   Summary: ${scheme.summary.substring(0, 60)}...`);
  console.log(`   CQs: ${scheme.cqs?.length || 0}`);
  
  const result = await exportSchemeToAIF(scheme.id, {
    format: "turtle",
    includeCQs: true,
    includeHierarchy: true,
    includeMeshExtensions: true,
  });
  
  if (result.success && result.data) {
    const lines = result.data.split("\n");
    
    // Count different triple types
    const typeCount = lines.filter(l => l.includes("a aif:Scheme") || l.includes("a aif:Question")).length;
    const labelCount = lines.filter(l => l.includes("rdfs:label")).length;
    const questionCount = lines.filter(l => l.includes("aif:hasQuestion")).length;
    const meshExtCount = lines.filter(l => l.includes("mesh:")).length;
    
    console.log(`\n📊 RDF Statistics:`);
    console.log(`   Total lines: ${lines.length}`);
    console.log(`   Type declarations (a): ${typeCount}`);
    console.log(`   Labels (rdfs:label): ${labelCount}`);
    console.log(`   Question links (aif:hasQuestion): ${questionCount}`);
    console.log(`   Mesh extensions (mesh:*): ${meshExtCount}`);
    
    // Show sample triples
    console.log(`\n📄 Sample Triples (first 15 non-prefix lines):`);
    const sampleLines = lines
      .filter(l => l.trim() && !l.startsWith("@prefix") && !l.startsWith("@base"))
      .slice(0, 15);
    
    sampleLines.forEach(line => {
      console.log(`   ${line}`);
    });
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║                  AIF EXPORT TEST SUITE (Phase 8E.2)               ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");
  
  ensureOutputDir();
  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  
  try {
    await testSingleSchemeExport();
    await testExportByKey();
    await testClusterExport();
    await testExportWithoutCQs();
    await testExportAll();
    await inspectRDFStructure();
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ ALL TESTS COMPLETED");
    console.log("=".repeat(70));
    console.log(`\n📁 Check output files in: ${OUTPUT_DIR}`);
    console.log("\nNext Steps:");
    console.log("  1. Inspect the generated RDF files");
    console.log("  2. Validate with RDF tools (rapper, jena, etc.)");
    console.log("  3. Test API endpoints manually in browser");
    console.log("  4. Verify SPARQL queries work against exported data");
    
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

// Run tests
main();
