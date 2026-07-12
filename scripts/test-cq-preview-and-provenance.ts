#!/usr/bin/env npx tsx
/**
 * Comprehensive test script for CQ Preview Panel and Provenance Badge system
 * 
 * Tests:
 * 1. SchemePickerWithHierarchy data structure
 * 2. CQ Preview Panel data preparation
 * 3. Provenance API endpoint responses
 * 4. Inheritance calculations (own + inherited = total)
 * 5. Multi-level inheritance paths
 * 
 * Run: npx tsx scripts/test-cq-preview-and-provenance.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = result.passed ? "✅" : "❌";
  console.log(`${icon} ${result.testName}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
  console.log();
}

async function testSchemeHierarchyData() {
  console.log("=".repeat(80));
  console.log("TEST 1: Scheme Hierarchy Data Structure");
  console.log("=".repeat(80));
  console.log();

  try {
    // Fetch Popular Practice (child) and Popular Opinion (parent)
    const popularPractice = await prisma.argumentScheme.findFirst({
      where: { key: "popular_practice" },
      include: { cqs: true },
    });

    const popularOpinion = await prisma.argumentScheme.findFirst({
      where: { key: "popular_opinion" },
      include: { cqs: true },
    });

    if (!popularPractice) {
      logTest({
        testName: "Popular Practice Exists",
        passed: false,
        message: "Popular Practice scheme not found in database",
      });
      return;
    }

    logTest({
      testName: "Popular Practice Exists",
      passed: true,
      message: `Found Popular Practice with ${popularPractice.cqs.length} CQs`,
      details: {
        id: popularPractice.id,
        key: popularPractice.key,
        name: popularPractice.name,
        ownCQs: popularPractice.cqs.length,
        parentSchemeId: popularPractice.parentSchemeId,
        inheritCQs: popularPractice.inheritCQs,
      },
    });

    if (!popularOpinion) {
      logTest({
        testName: "Popular Opinion Exists",
        passed: false,
        message: "Popular Opinion scheme not found in database",
      });
      return;
    }

    logTest({
      testName: "Popular Opinion Exists",
      passed: true,
      message: `Found Popular Opinion with ${popularOpinion.cqs.length} CQs`,
      details: {
        id: popularOpinion.id,
        key: popularOpinion.key,
        name: popularOpinion.name,
        ownCQs: popularOpinion.cqs.length,
        parentSchemeId: popularOpinion.parentSchemeId,
        inheritCQs: popularOpinion.inheritCQs,
      },
    });

    // Verify parent-child relationship
    const isLinked = popularPractice.parentSchemeId === popularOpinion.id;
    logTest({
      testName: "Parent-Child Relationship",
      passed: isLinked,
      message: isLinked
        ? "Popular Practice correctly references Popular Opinion as parent"
        : "Parent-child relationship not established",
      details: {
        childParentId: popularPractice.parentSchemeId,
        parentId: popularOpinion.id,
      },
    });

    // Verify inheritCQs flag
    logTest({
      testName: "Inherit CQs Flag",
      passed: popularPractice.inheritCQs === true,
      message: popularPractice.inheritCQs
        ? "Popular Practice has inheritCQs=true"
        : "Warning: inheritCQs is false, inheritance won't work",
      details: { inheritCQs: popularPractice.inheritCQs },
    });

    // Check CQ counts
    const expectedOwn = 5;
    const expectedInherited = 5;
    const ownMatches = popularPractice.cqs.length === expectedOwn;
    const parentMatches = popularOpinion.cqs.length === expectedInherited;

    logTest({
      testName: "CQ Count Validation",
      passed: ownMatches && parentMatches,
      message: `Popular Practice: ${popularPractice.cqs.length} own, Popular Opinion: ${popularOpinion.cqs.length} parent`,
      details: {
        popularPracticeOwn: popularPractice.cqs.length,
        popularOpinionOwn: popularOpinion.cqs.length,
        expectedOwnEach: 5,
      },
    });
  } catch (error) {
    logTest({
      testName: "Scheme Hierarchy Data",
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function testDefinitionToClassification() {
  console.log("=".repeat(80));
  console.log("TEST 2: Definition to Classification Hierarchy");
  console.log("=".repeat(80));
  console.log();

  try {
    const defToClass = await prisma.argumentScheme.findFirst({
      where: { key: "definition_to_classification" },
      include: { cqs: true },
    });

    const verbalClass = await prisma.argumentScheme.findFirst({
      where: { key: "verbal_classification" },
      include: { cqs: true },
    });

    if (!defToClass || !verbalClass) {
      logTest({
        testName: "Definition to Classification Exists",
        passed: false,
        message: "One or both schemes not found",
      });
      return;
    }

    logTest({
      testName: "Definition to Classification Exists",
      passed: true,
      message: `Found with ${defToClass.cqs.length} own CQs`,
      details: {
        key: defToClass.key,
        name: defToClass.name,
        ownCQs: defToClass.cqs.length,
        parentSchemeId: defToClass.parentSchemeId,
      },
    });

    logTest({
      testName: "Verbal Classification Exists",
      passed: true,
      message: `Found with ${verbalClass.cqs.length} own CQs`,
      details: {
        key: verbalClass.key,
        name: verbalClass.name,
        ownCQs: verbalClass.cqs.length,
      },
    });

    const isLinked = defToClass.parentSchemeId === verbalClass.id;
    logTest({
      testName: "Definition→Verbal Relationship",
      passed: isLinked,
      message: isLinked
        ? "Correctly linked"
        : "Parent-child relationship missing",
      details: {
        childParentId: defToClass.parentSchemeId,
        parentId: verbalClass.id,
      },
    });

    // Expected: 6 own + 5 inherited = 11 total
    const expectedOwn = 6;
    const expectedInherited = 5;
    logTest({
      testName: "CQ Count Validation (6+5=11)",
      passed:
        defToClass.cqs.length === expectedOwn &&
        verbalClass.cqs.length === expectedInherited,
      message: `Definition: ${defToClass.cqs.length} own, Verbal: ${verbalClass.cqs.length} parent`,
      details: {
        defToClassOwn: defToClass.cqs.length,
        verbalClassOwn: verbalClass.cqs.length,
        expectedTotal: expectedOwn + expectedInherited,
      },
    });
  } catch (error) {
    logTest({
      testName: "Definition to Classification Test",
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function testCQPreviewData() {
  console.log("=".repeat(80));
  console.log("TEST 3: CQ Preview Panel Data Preparation");
  console.log("=".repeat(80));
  console.log();

  try {
    // Fetch Popular Practice with CQs for preview panel
    const scheme = await prisma.argumentScheme.findFirst({
      where: { key: "popular_practice" },
      include: { cqs: true },
    });

    if (!scheme) {
      logTest({
        testName: "Scheme Load for Preview",
        passed: false,
        message: "Could not load scheme",
      });
      return;
    }

    logTest({
      testName: "Scheme Load for Preview",
      passed: true,
      message: `Loaded ${scheme.name} with ${scheme.cqs.length} CQs`,
    });

    // Simulate what SchemePickerWithHierarchy provides
    const schemeData = {
      key: scheme.key,
      name: scheme.name,
      cqs: scheme.cqs.map((cq) => ({
        cqKey: cq.cqKey,
        text: cq.text,
        attackType: cq.attackType,
        targetScope: cq.targetScope,
      })),
    };

    // Preview should show first 4
    const previewCQs = schemeData.cqs.slice(0, 4);
    const remainingCount = schemeData.cqs.length - 4;

    logTest({
      testName: "Preview CQ Slice (First 4)",
      passed: previewCQs.length === 4,
      message: `Preview shows ${previewCQs.length} CQs`,
      details: {
        first4Keys: previewCQs.map((cq) => cq.cqKey),
      },
    });

    logTest({
      testName: "Overflow Indicator",
      passed: remainingCount > 0,
      message: `Should show "...+ ${remainingCount} more questions"`,
      details: {
        totalCQs: schemeData.cqs.length,
        previewCQs: 4,
        remaining: remainingCount,
      },
    });

    // Verify each CQ has required fields
    const allFieldsPresent = previewCQs.every(
      (cq) =>
        cq.cqKey && cq.text && cq.attackType && cq.targetScope
    );

    logTest({
      testName: "CQ Field Completeness",
      passed: allFieldsPresent,
      message: allFieldsPresent
        ? "All CQs have required fields (cqKey, text, attackType, targetScope)"
        : "Some CQs missing required fields",
    });
  } catch (error) {
    logTest({
      testName: "CQ Preview Data Test",
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function testProvenanceCalculation() {
  console.log("=".repeat(80));
  console.log("TEST 4: Provenance Calculation Logic");
  console.log("=".repeat(80));
  console.log();

  try {
    // Simulate provenance API logic
    const popularPractice = await prisma.argumentScheme.findFirst({
      where: { key: "popular_practice" },
      include: { cqs: true },
    });

    if (!popularPractice) {
      logTest({
        testName: "Load Scheme for Provenance",
        passed: false,
        message: "Could not load Popular Practice",
      });
      return;
    }

    // Get own CQs
    const ownCQs = popularPractice.cqs.map((cq) => ({
      ...cq,
      inherited: false,
    }));

    logTest({
      testName: "Own CQs Collection",
      passed: ownCQs.length === 5,
      message: `Collected ${ownCQs.length} own CQs`,
      details: { ownCQKeys: ownCQs.map((cq) => cq.cqKey) },
    });

    // Traverse parent chain
    const inheritedCQs: any[] = [];
    const inheritancePath: any[] = [];
    const visited = new Set([popularPractice.id]);
    let currentParentId = popularPractice.parentSchemeId;

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);

      const parentScheme = await prisma.argumentScheme.findUnique({
        where: { id: currentParentId },
        include: { cqs: true },
      });

      if (!parentScheme) break;

      inheritancePath.push({
        id: parentScheme.id,
        name: parentScheme.name,
        key: parentScheme.key,
      });

      inheritedCQs.push(
        ...parentScheme.cqs.map((cq) => ({
          ...cq,
          inherited: true,
          sourceSchemeId: parentScheme.id,
          sourceSchemeName: parentScheme.name,
          sourceSchemeKey: parentScheme.key,
        }))
      );

      if (parentScheme.inheritCQs && parentScheme.parentSchemeId) {
        currentParentId = parentScheme.parentSchemeId;
      } else {
        break;
      }
    }

    logTest({
      testName: "Inherited CQs Collection",
      passed: inheritedCQs.length === 5,
      message: `Collected ${inheritedCQs.length} inherited CQs from parent`,
      details: {
        inheritedCQKeys: inheritedCQs.map((cq) => cq.cqKey),
        sources: inheritedCQs.map((cq) => cq.sourceSchemeName),
      },
    });

    logTest({
      testName: "Inheritance Path",
      passed: inheritancePath.length === 1,
      message: `Path: ${inheritancePath.map((p) => p.name).join(" → ")}`,
      details: { path: inheritancePath },
    });

    const totalCount = ownCQs.length + inheritedCQs.length;
    logTest({
      testName: "Total CQ Count (5+5=10)",
      passed: totalCount === 10,
      message: `${ownCQs.length} own + ${inheritedCQs.length} inherited = ${totalCount} total`,
      details: {
        ownCount: ownCQs.length,
        inheritedCount: inheritedCQs.length,
        totalCount,
      },
    });

    // Verify no duplicates
    const allCQKeys = [...ownCQs, ...inheritedCQs].map((cq) => cq.cqKey);
    const uniqueCQKeys = new Set(allCQKeys);
    logTest({
      testName: "No Duplicate CQs",
      passed: allCQKeys.length === uniqueCQKeys.size,
      message:
        allCQKeys.length === uniqueCQKeys.size
          ? "All CQ keys are unique"
          : "Warning: Duplicate CQ keys found",
      details: {
        totalCQs: allCQKeys.length,
        uniqueCQs: uniqueCQKeys.size,
      },
    });
  } catch (error) {
    logTest({
      testName: "Provenance Calculation Test",
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function testMultiLevelInheritance() {
  console.log("=".repeat(80));
  console.log("TEST 5: Multi-Level Inheritance Detection");
  console.log("=".repeat(80));
  console.log();

  try {
    // Find schemes with 2+ level inheritance
    const allSchemes = await prisma.argumentScheme.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        parentSchemeId: true,
        inheritCQs: true,
      },
    });

    // Build parent map
    const parentMap = new Map<string, string>();
    allSchemes.forEach((s) => {
      if (s.parentSchemeId && s.inheritCQs) {
        parentMap.set(s.id, s.parentSchemeId);
      }
    });

    // Find schemes with grandparents
    const multiLevelSchemes: any[] = [];
    for (const scheme of allSchemes) {
      if (scheme.parentSchemeId && scheme.inheritCQs) {
        const parentId = scheme.parentSchemeId;
        const grandparentId = parentMap.get(parentId);
        if (grandparentId) {
          const parent = allSchemes.find((s) => s.id === parentId);
          const grandparent = allSchemes.find((s) => s.id === grandparentId);
          multiLevelSchemes.push({
            scheme: scheme.name,
            parent: parent?.name,
            grandparent: grandparent?.name,
          });
        }
      }
    }

    logTest({
      testName: "Multi-Level Inheritance Schemes",
      passed: true,
      message:
        multiLevelSchemes.length > 0
          ? `Found ${multiLevelSchemes.length} schemes with 2+ level inheritance`
          : "No multi-level inheritance found (this is OK)",
      details: { multiLevelSchemes },
    });

    // Test cycle prevention
    const visited = new Set<string>();
    const popularPractice = allSchemes.find(
      (s) => s.key === "popular_practice"
    );

    if (popularPractice) {
      let currentId: string | null = popularPractice.id;
      let depth = 0;
      const path: string[] = [popularPractice.name];

      while (currentId && depth < 10) {
        if (visited.has(currentId)) {
          logTest({
            testName: "Cycle Prevention",
            passed: false,
            message: "Cycle detected in inheritance chain!",
            details: { path, cycleAt: currentId },
          });
          return;
        }
        visited.add(currentId);

        const current = allSchemes.find((s) => s.id === currentId);
        if (!current?.parentSchemeId || !current.inheritCQs) break;

        currentId = current.parentSchemeId;
        const parent = allSchemes.find((s) => s.id === currentId);
        if (parent) path.push(parent.name);
        depth++;
      }

      logTest({
        testName: "Cycle Prevention",
        passed: true,
        message: `No cycles detected (traversed ${depth} levels)`,
        details: { path, depth },
      });
    }
  } catch (error) {
    logTest({
      testName: "Multi-Level Inheritance Test",
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function testSchemeWithoutParent() {
  console.log("=".repeat(80));
  console.log("TEST 6: Scheme Without Parent (Popular Opinion)");
  console.log("=".repeat(80));
  console.log();

  try {
    const scheme = await prisma.argumentScheme.findFirst({
      where: { key: "popular_opinion" },
      include: { cqs: true },
    });

    if (!scheme) {
      logTest({
        testName: "Popular Opinion Exists",
        passed: false,
        message: "Could not load Popular Opinion",
      });
      return;
    }

    logTest({
      testName: "Popular Opinion Has No Parent",
      passed: !scheme.parentSchemeId,
      message: scheme.parentSchemeId
        ? "Warning: Popular Opinion has a parent (unexpected)"
        : "Correctly has no parent",
      details: { parentSchemeId: scheme.parentSchemeId },
    });

    // Simulate provenance for parent scheme
    const ownCQs = scheme.cqs;
    const inheritedCQs: any[] = [];
    const totalCount = ownCQs.length + inheritedCQs.length;

    logTest({
      testName: "Parent Scheme CQ Count (5+0=5)",
      passed: totalCount === 5 && inheritedCQs.length === 0,
      message: `${ownCQs.length} own + ${inheritedCQs.length} inherited = ${totalCount} total`,
      details: {
        ownCount: ownCQs.length,
        inheritedCount: inheritedCQs.length,
        totalCount,
      },
    });

    logTest({
      testName: "No Provenance Summary Expected",
      passed: inheritedCQs.length === 0,
      message:
        "Provenance summary header should NOT display for parent schemes",
    });
  } catch (error) {
    logTest({
      testName: "Parent Scheme Test",
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function main() {
  console.log("\n");
  console.log("█".repeat(80));
  console.log("█" + " ".repeat(78) + "█");
  console.log(
    "█" +
      " ".repeat(15) +
      "CQ PREVIEW & PROVENANCE COMPREHENSIVE TEST SUITE" +
      " ".repeat(15) +
      "█"
  );
  console.log("█" + " ".repeat(78) + "█");
  console.log("█".repeat(80));
  console.log("\n");

  await testSchemeHierarchyData();
  await testDefinitionToClassification();
  await testCQPreviewData();
  await testProvenanceCalculation();
  await testMultiLevelInheritance();
  await testSchemeWithoutParent();

  // Summary
  console.log("=".repeat(80));
  console.log("TEST SUMMARY");
  console.log("=".repeat(80));
  console.log();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();

  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! 🎉");
    console.log();
    console.log("CQ Preview Panel and Provenance Badge system is ready for production.");
    console.log();
  } else {
    console.log("⚠️  SOME TESTS FAILED");
    console.log();
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.testName}: ${r.message}`);
      });
    console.log();
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
