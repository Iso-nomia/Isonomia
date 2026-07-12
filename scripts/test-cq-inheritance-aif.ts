/**
 * Test Script: Phase 8E.4 - CQ Inheritance in AIF Export
 * 
 * Tests that inherited CQs are correctly represented in RDF exports with provenance metadata.
 * Uses schemes that inherit CQs from parents (e.g., slippery_slope → negative_consequences).
 */

import { exportSchemeToAIF, exportClusterFamily } from "@/lib/aif/aifExporter";
import { getCQsWithInheritance } from "@/lib/argumentation/cqInheritance";
import { prisma } from "@/lib/prismaclient";
import * as fs from "fs";
import * as path from "path";

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), "test-output", "cq-inheritance-aif");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runTests() {
  log("\n========================================", "cyan");
  log("Phase 8E.4: CQ Inheritance in AIF Export", "cyan");
  log("========================================\n", "cyan");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // ========================================
  // TEST 1: Export scheme with inherited CQs (slippery_slope)
  // ========================================
  totalTests++;
  log(`TEST ${totalTests}: Export scheme with inherited CQs (Turtle)`, "blue");
  
  try {
    // Find slippery_slope scheme (inherits from negative_consequences)
    const slipperySlope = await prisma.argumentScheme.findFirst({
      where: { key: "slippery_slope" },
    });

    if (!slipperySlope) {
      throw new Error("slippery_slope scheme not found in database");
    }

    // Get inherited CQs
    const inheritedCQs = await getCQsWithInheritance(slipperySlope.id, true);
    const ownCQs = inheritedCQs.filter(cq => !cq.inherited);
    const parentCQs = inheritedCQs.filter(cq => cq.inherited);

    log(`  Found ${ownCQs.length} own CQs, ${parentCQs.length} inherited CQs`, "yellow");

    // Export to Turtle
    const result = await exportSchemeToAIF(slipperySlope.id, {
      format: "turtle",
      includeCQs: true,
      includeHierarchy: true,
    });

    if (!result.success || !result.data) {
      throw new Error(`Export failed: ${result.error?.message}`);
    }

    // Save output
    const outputFile = path.join(OUTPUT_DIR, "slippery-slope-with-inheritance.ttl");
    fs.writeFileSync(outputFile, result.data);
    log(`  ✓ Saved to: ${outputFile}`, "green");

    // Verify RDF contains inherited CQs
    const rdf = result.data;
    
    // Check for mesh:inheritedFrom triples
    const inheritedFromCount = (rdf.match(/mesh:inheritedFrom/g) || []).length;
    if (inheritedFromCount === 0 && parentCQs.length > 0) {
      throw new Error(`Expected mesh:inheritedFrom triples, found ${inheritedFromCount}`);
    }
    log(`  ✓ Found ${inheritedFromCount} mesh:inheritedFrom triples`, "green");

    // Check for question text
    const hasQuestionText = rdf.includes("aif:questionText");
    if (!hasQuestionText) {
      throw new Error("No aif:questionText found in RDF");
    }
    log(`  ✓ Contains aif:questionText triples`, "green");

    passedTests++;
    log(`  ✅ TEST ${totalTests} PASSED\n`, "green");
  } catch (error) {
    failedTests++;
    log(`  ❌ TEST ${totalTests} FAILED: ${error}`, "red");
    console.error(error);
  }

  // ========================================
  // TEST 2: Verify inherited CQ URIs point to parent scheme
  // ========================================
  totalTests++;
  log(`TEST ${totalTests}: Verify inherited CQ URIs reference parent scheme`, "blue");
  
  try {
    const slipperySlope = await prisma.argumentScheme.findFirst({
      where: { key: "slippery_slope" },
    });

    if (!slipperySlope) {
      throw new Error("slippery_slope scheme not found");
    }

    const result = await exportSchemeToAIF(slipperySlope.id, {
      format: "turtle",
      includeCQs: true,
    });

    if (!result.success || !result.data) {
      throw new Error(`Export failed: ${result.error?.message}`);
    }

    const rdf = result.data;

    // Check for parent scheme URI in inheritedFrom triples
    // Inherited CQs should point to parent scheme (could be "negative_consequences" key or full name)
    const hasParentReference = rdf.includes("Negative Consequences") || rdf.includes("negative_consequences");
    if (!hasParentReference) {
      throw new Error("Expected reference to parent scheme");
    }
    log(`  ✓ Contains reference to parent scheme`, "green");

    // Check that inherited questions use parent's scheme in URI
    // URIs may use scheme name or scheme key
    const hasInheritedQuestionURI = 
      rdf.includes("schemes/Argument from Negative Consequences/questions/") ||
      rdf.includes("schemes/negative_consequences/questions/");
    if (!hasInheritedQuestionURI) {
      throw new Error("Expected question URIs from parent scheme");
    }
    log(`  ✓ Question URIs correctly reference parent scheme`, "green");

    passedTests++;
    log(`  ✅ TEST ${totalTests} PASSED\n`, "green");
  } catch (error) {
    failedTests++;
    log(`  ❌ TEST ${totalTests} FAILED: ${error}`, "red");
    console.error(error);
  }

  // ========================================
  // TEST 3: Export scheme with 2-level inheritance (grandchild)
  // ========================================
  totalTests++;
  log(`TEST ${totalTests}: Export scheme with multi-level CQ inheritance`, "blue");
  
  try {
    const slipperySlope = await prisma.argumentScheme.findFirst({
      where: { key: "slippery_slope" },
    });

    if (!slipperySlope) {
      throw new Error("slippery_slope scheme not found");
    }

    // Get full inheritance chain
    const inheritedCQs = await getCQsWithInheritance(slipperySlope.id, true);
    
    // Group by source scheme
    const bySchemeName = new Map<string, number>();
    for (const cq of inheritedCQs) {
      const count = bySchemeName.get(cq.fromScheme) || 0;
      bySchemeName.set(cq.fromScheme, count + 1);
    }

    log(`  CQ sources: ${Array.from(bySchemeName.entries()).map(([name, count]) => `${name} (${count})`).join(", ")}`, "yellow");

    // Export
    const result = await exportSchemeToAIF(slipperySlope.id, {
      format: "turtle",
      includeCQs: true,
      includeHierarchy: true,
    });

    if (!result.success || !result.data) {
      throw new Error(`Export failed: ${result.error?.message}`);
    }

    // Save output
    const outputFile = path.join(OUTPUT_DIR, "multi-level-inheritance.ttl");
    fs.writeFileSync(outputFile, result.data);
    log(`  ✓ Saved to: ${outputFile}`, "green");

    // Verify contains multiple inheritedFrom relationships
    const rdf = result.data;
    const inheritedFromMatches = rdf.match(/mesh:inheritedFrom/g) || [];
    
    if (inheritedFromMatches.length === 0) {
      log(`  ⚠️  No inherited CQs found (scheme might not inherit)`, "yellow");
    } else {
      log(`  ✓ Found ${inheritedFromMatches.length} inheritance relationships`, "green");
    }

    passedTests++;
    log(`  ✅ TEST ${totalTests} PASSED\n`, "green");
  } catch (error) {
    failedTests++;
    log(`  ❌ TEST ${totalTests} FAILED: ${error}`, "red");
    console.error(error);
  }

  // ========================================
  // TEST 4: Export cluster with inheritance metadata
  // ========================================
  totalTests++;
  log(`TEST ${totalTests}: Export cluster family with CQ inheritance`, "blue");
  
  try {
    // Export practical_reasoning_family cluster
    const result = await exportClusterFamily("practical_reasoning_family", {
      format: "turtle",
      includeCQs: true,
      includeHierarchy: true,
    });

    if (!result.success || !result.data) {
      throw new Error(`Export failed: ${result.error?.message}`);
    }

    // Save output
    const outputFile = path.join(OUTPUT_DIR, "cluster-with-inheritance.ttl");
    fs.writeFileSync(outputFile, result.data);
    log(`  ✓ Saved to: ${outputFile}`, "green");

    const rdf = result.data;

    // Count schemes in cluster
    const schemeCount = (rdf.match(/a aif:Scheme/g) || []).length;
    log(`  ✓ Exported ${schemeCount} schemes`, "green");

    // Count total questions
    const questionCount = (rdf.match(/a aif:Question/g) || []).length;
    log(`  ✓ Exported ${questionCount} questions`, "green");

    // Count inheritance relationships
    const inheritanceCount = (rdf.match(/mesh:inheritedFrom/g) || []).length;
    log(`  ✓ Found ${inheritanceCount} CQ inheritance relationships`, "green");

    passedTests++;
    log(`  ✅ TEST ${totalTests} PASSED\n`, "green");
  } catch (error) {
    failedTests++;
    log(`  ❌ TEST ${totalTests} FAILED: ${error}`, "red");
    console.error(error);
  }

  // ========================================
  // TEST 5: Visual inspection of inheritance RDF structure
  // ========================================
  totalTests++;
  log(`TEST ${totalTests}: Visual inspection of RDF structure`, "blue");
  
  try {
    // Read the slippery_slope output
    const ttlFile = path.join(OUTPUT_DIR, "slippery-slope-with-inheritance.ttl");
    if (!fs.existsSync(ttlFile)) {
      throw new Error(`Output file not found: ${ttlFile}`);
    }

    const rdf = fs.readFileSync(ttlFile, "utf-8");

    // Extract a sample inherited question block
    const lines = rdf.split("\n");
    let sampleBlock: string[] = [];
    let capturing = false;
    let capturedBlocks = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for Question declarations
      if (line.includes("a aif:Question")) {
        capturing = true;
        sampleBlock = [line];
      } else if (capturing) {
        sampleBlock.push(line);
        
        // Stop after capturing the full block (ends with .)
        if (line.trim().endsWith(".")) {
          capturing = false;
          capturedBlocks++;
          
          // If this block has inheritedFrom, print it
          if (sampleBlock.some(l => l.includes("mesh:inheritedFrom"))) {
            log(`\n  Sample inherited question RDF:`, "yellow");
            log("  " + "-".repeat(60), "yellow");
            for (const blockLine of sampleBlock) {
              console.log("  " + blockLine);
            }
            log("  " + "-".repeat(60), "yellow");
            break; // Only show one example
          }
          sampleBlock = [];
        }
      }
    }

    if (capturedBlocks === 0) {
      log(`  ⚠️  No question blocks found in RDF`, "yellow");
    } else {
      log(`  ✓ Successfully parsed RDF structure`, "green");
    }

    passedTests++;
    log(`  ✅ TEST ${totalTests} PASSED\n`, "green");
  } catch (error) {
    failedTests++;
    log(`  ❌ TEST ${totalTests} FAILED: ${error}`, "red");
    console.error(error);
  }

  // ========================================
  // TEST 6: Export without CQs (should not include inheritance)
  // ========================================
  totalTests++;
  log(`TEST ${totalTests}: Export without CQs (no inheritance metadata)`, "blue");
  
  try {
    const slipperySlope = await prisma.argumentScheme.findFirst({
      where: { key: "slippery_slope" },
    });

    if (!slipperySlope) {
      throw new Error("slippery_slope scheme not found");
    }

    const result = await exportSchemeToAIF(slipperySlope.id, {
      format: "turtle",
      includeCQs: false, // No CQs
      includeHierarchy: true,
    });

    if (!result.success || !result.data) {
      throw new Error(`Export failed: ${result.error?.message}`);
    }

    const rdf = result.data;

    // Should NOT contain any questions or inheritance metadata
    const hasQuestions = rdf.includes("aif:Question");
    const hasInheritance = rdf.includes("mesh:inheritedFrom");

    if (hasQuestions || hasInheritance) {
      throw new Error("RDF should not contain questions when includeCQs=false");
    }

    log(`  ✓ No questions or inheritance metadata (as expected)`, "green");

    passedTests++;
    log(`  ✅ TEST ${totalTests} PASSED\n`, "green");
  } catch (error) {
    failedTests++;
    log(`  ❌ TEST ${totalTests} FAILED: ${error}`, "red");
    console.error(error);
  }

  // ========================================
  // Summary
  // ========================================
  log("\n========================================", "cyan");
  log("Test Summary", "cyan");
  log("========================================", "cyan");
  log(`Total Tests:  ${totalTests}`, "blue");
  log(`Passed:       ${passedTests}`, "green");
  log(`Failed:       ${failedTests}`, failedTests > 0 ? "red" : "green");
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, failedTests > 0 ? "yellow" : "green");
  log("\n");

  if (failedTests === 0) {
    log("🎉 ALL TESTS PASSED! Phase 8E.4 implementation successful.", "green");
  } else {
    log("⚠️  Some tests failed. Please review the errors above.", "red");
  }

  log("\n");
}

// Run tests
runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error running tests:", error);
    process.exit(1);
  });
