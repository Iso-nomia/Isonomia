#!/usr/bin/env tsx
/**
 * Test Script: Composition Tracking (Task 3.2)
 * 
 * Verifies:
 * 1. Preview endpoint accepts depth parameter (1-3)
 * 2. Premise chains detected and returned in proposals
 * 3. ArgumentEdge records created for composition
 * 4. Recursive import preserves structure at depth > 1
 * 5. Structure preservation via extractArgumentStructure
 */

import { prisma } from "../lib/prismaclient";
import { 
  extractArgumentStructure, 
  reconstructArgumentStructure,
  recursivelyImportPremises,
  type ClaimMapping 
} from "../lib/arguments/structure-import";

const TEST_USER_ID = "test-user-composition";

async function cleanup() {
  console.log("🧹 Cleaning up test data...");
  
  // Delete test deliberations and related data (cascade will handle most)
  await prisma.deliberation.deleteMany({
    where: {
      id: {
        in: ["test-delib-source-comp", "test-delib-target-comp"]
      }
    }
  });
  
  console.log("✅ Cleanup complete\n");
}

async function setupTestData() {
  console.log("📦 Setting up test data...\n");
  
  // Create source deliberation
  const sourceDelib = await prisma.deliberation.create({
    data: {
      id: "test-delib-source-comp",
      title: "Source Deliberation (Composition Test)",
      visibility: "public",
      createdById: TEST_USER_ID,
    }
  });
  
  // Create target deliberation
  const targetDelib = await prisma.deliberation.create({
    data: {
      id: "test-delib-target-comp",
      title: "Target Deliberation (Composition Test)",
      visibility: "public",
      createdById: TEST_USER_ID,
    }
  });
  
  // Create claims in source
  const sourceClaim1 = await prisma.claim.create({
    data: {
      deliberationId: sourceDelib.id,
      text: "Climate change is caused by human activities",
      createdById: TEST_USER_ID,
    }
  });
  
  const sourceClaim2 = await prisma.claim.create({
    data: {
      deliberationId: sourceDelib.id,
      text: "CO2 levels have increased significantly",
      createdById: TEST_USER_ID,
    }
  });
  
  const sourceClaim3 = await prisma.claim.create({
    data: {
      deliberationId: sourceDelib.id,
      text: "Temperature records show warming trend",
      createdById: TEST_USER_ID,
    }
  });
  
  // Create claims in target (mapped)
  const targetClaim1 = await prisma.claim.create({
    data: {
      deliberationId: targetDelib.id,
      text: "Human activity causes climate change",
      createdById: TEST_USER_ID,
    }
  });
  
  const targetClaim2 = await prisma.claim.create({
    data: {
      deliberationId: targetDelib.id,
      text: "Carbon dioxide levels are rising",
      createdById: TEST_USER_ID,
    }
  });
  
  const targetClaim3 = await prisma.claim.create({
    data: {
      deliberationId: targetDelib.id,
      text: "Global temperatures are increasing",
      createdById: TEST_USER_ID,
    }
  });
  
  // Create ArgumentDiagram for premise argument (level 2)
  const premiseDiagram2 = await prisma.argumentDiagram.create({
    data: {
      title: "Temperature evidence",
      createdById: TEST_USER_ID,
      statements: {
        create: [
          {
            text: "NASA temperature data shows 1.2°C increase",
            role: "premise",
            tags: [],
          },
          {
            text: "Temperature records show warming trend",
            role: "conclusion",
            tags: [],
          }
        ]
      }
    },
    include: {
      statements: true
    }
  });
  
  const premiseInf2 = await prisma.inference.create({
    data: {
      diagramId: premiseDiagram2.id,
      kind: "inductive",
      conclusionId: premiseDiagram2.statements.find(s => s.role === "conclusion")!.id,
    }
  });
  
  await prisma.inferencePremise.create({
    data: {
      inferenceId: premiseInf2.id,
      statementId: premiseDiagram2.statements.find(s => s.role === "premise")!.id,
    }
  });
  
  // Create premise argument (level 2)
  const premiseArg2 = await prisma.argument.create({
    data: {
      deliberationId: sourceDelib.id,
      claimId: sourceClaim3.id,
      text: "Temperature data supports warming",
      authorId: TEST_USER_ID,
      isImplicit: false,
    }
  });
  
  await prisma.debateNode.create({
    data: {
      sheetId: sourceDelib.id,
      argumentId: premiseArg2.id,
      diagramId: premiseDiagram2.id,
      title: "Temperature evidence",
    }
  });
  
  await prisma.argumentSupport.create({
    data: {
      deliberationId: sourceDelib.id,
      claimId: sourceClaim3.id,
      argumentId: premiseArg2.id,
      base: 0.85,
    }
  });
  
  // Create ArgumentDiagram for premise argument (level 1)
  const premiseDiagram1 = await prisma.argumentDiagram.create({
    data: {
      title: "CO2 increase evidence",
      createdById: TEST_USER_ID,
      statements: {
        create: [
          {
            text: "Keeling Curve shows 50% CO2 increase since 1950",
            role: "premise",
            tags: [],
          },
          {
            text: "CO2 levels have increased significantly",
            role: "conclusion",
            tags: [],
          }
        ]
      }
    },
    include: {
      statements: true
    }
  });
  
  const premiseInf1 = await prisma.inference.create({
    data: {
      diagramId: premiseDiagram1.id,
      kind: "inductive",
      conclusionId: premiseDiagram1.statements.find(s => s.role === "conclusion")!.id,
    }
  });
  
  await prisma.inferencePremise.create({
    data: {
      inferenceId: premiseInf1.id,
      statementId: premiseDiagram1.statements.find(s => s.role === "premise")!.id,
    }
  });
  
  // Create premise argument (level 1)
  const premiseArg1 = await prisma.argument.create({
    data: {
      deliberationId: sourceDelib.id,
      claimId: sourceClaim2.id,
      text: "CO2 measurements show increase",
      authorId: TEST_USER_ID,
      isImplicit: false,
    }
  });
  
  await prisma.debateNode.create({
    data: {
      sheetId: sourceDelib.id,
      argumentId: premiseArg1.id,
      diagramId: premiseDiagram1.id,
      title: "CO2 increase evidence",
    }
  });
  
  await prisma.argumentSupport.create({
    data: {
      deliberationId: sourceDelib.id,
      claimId: sourceClaim2.id,
      argumentId: premiseArg1.id,
      base: 0.9,
    }
  });
  
  // Create ArgumentDiagram for main argument (level 0)
  const mainDiagram = await prisma.argumentDiagram.create({
    data: {
      title: "Climate change argument",
      createdById: TEST_USER_ID,
      statements: {
        create: [
          {
            text: "CO2 levels have increased significantly",
            role: "premise",
            tags: [],
          },
          {
            text: "Temperature records show warming trend",
            role: "premise",
            tags: [],
          },
          {
            text: "Climate change is caused by human activities",
            role: "conclusion",
            tags: [],
          }
        ]
      }
    },
    include: {
      statements: true
    }
  });
  
  const mainInf = await prisma.inference.create({
    data: {
      diagramId: mainDiagram.id,
      kind: "abductive",
      conclusionId: mainDiagram.statements.find(s => s.role === "conclusion")!.id,
      schemeKey: "causal_reasoning",
    }
  });
  
  for (const stmt of mainDiagram.statements.filter(s => s.role === "premise")) {
    await prisma.inferencePremise.create({
      data: {
        inferenceId: mainInf.id,
        statementId: stmt.id,
      }
    });
  }
  
  // Create main argument
  const mainArg = await prisma.argument.create({
    data: {
      deliberationId: sourceDelib.id,
      claimId: sourceClaim1.id,
      text: "Human activities cause climate change based on CO2 and temperature data",
      authorId: TEST_USER_ID,
      isImplicit: false,
    }
  });
  
  await prisma.debateNode.create({
    data: {
      sheetId: sourceDelib.id,
      argumentId: mainArg.id,
      diagramId: mainDiagram.id,
      title: "Climate change argument",
    }
  });
  
  await prisma.argumentSupport.create({
    data: {
      deliberationId: sourceDelib.id,
      claimId: sourceClaim1.id,
      argumentId: mainArg.id,
      base: 0.8,
    }
  });
  
  // Create ArgumentEdges linking main → premise1 and main → premise2
  await prisma.argumentEdge.create({
    data: {
      fromArgumentId: premiseArg1.id,
      toArgumentId: mainArg.id,
      type: "support",
      deliberationId: sourceDelib.id,
      createdById: TEST_USER_ID,
    }
  });
  
  await prisma.argumentEdge.create({
    data: {
      fromArgumentId: premiseArg2.id,
      toArgumentId: mainArg.id,
      type: "support",
      deliberationId: sourceDelib.id,
      createdById: TEST_USER_ID,
    }
  });
  
  console.log("✅ Test data created:");
  console.log(`   Source: ${sourceDelib.id}`);
  console.log(`   Target: ${targetDelib.id}`);
  console.log(`   Main Arg: ${mainArg.id} (has 2 premise args)`);
  console.log(`   Premise 1: ${premiseArg1.id} (CO2 data)`);
  console.log(`   Premise 2: ${premiseArg2.id} (Temperature data)`);
  console.log("");
  
  return {
    sourceDelib,
    targetDelib,
    sourceClaim1,
    sourceClaim2,
    sourceClaim3,
    targetClaim1,
    targetClaim2,
    targetClaim3,
    mainArg,
    premiseArg1,
    premiseArg2,
  };
}

async function testExtractStructure(data: Awaited<ReturnType<typeof setupTestData>>) {
  console.log("🧪 Test 1: Extract Argument Structure\n");
  
  const structure = await extractArgumentStructure(
    data.mainArg.id,
    data.sourceDelib.id
  );
  
  if (!structure) {
    console.error("❌ FAILED: Could not extract structure");
    return false;
  }
  
  console.log("✅ Structure extracted:");
  console.log(`   Statements: ${structure.statements.length}`);
  console.log(`   Inferences: ${structure.inferences.length}`);
  console.log(`   Premise Arguments: ${structure.premiseArguments?.length ?? 0}`);
  
  if ((structure.premiseArguments?.length ?? 0) !== 2) {
    console.error(`❌ FAILED: Expected 2 premise arguments, got ${structure.premiseArguments?.length ?? 0}`);
    return false;
  }
  
  console.log(`   ✓ Premise 1: ${structure.premiseArguments![0]}`);
  console.log(`   ✓ Premise 2: ${structure.premiseArguments![1]}`);
  console.log("");
  
  return true;
}

async function testPreviewDepth(data: Awaited<ReturnType<typeof setupTestData>>) {
  console.log("🧪 Test 2: Preview with Depth Parameter\n");
  
  const claimMap: ClaimMapping = {
    [data.sourceClaim1.id]: data.targetClaim1.id,
    [data.sourceClaim2.id]: data.targetClaim2.id,
    [data.sourceClaim3.id]: data.targetClaim3.id,
  };
  
  // Test depth=1 (no premise detection)
  console.log("Testing depth=1 (no premise detection)...");
  const res1 = await fetch("http://localhost:3000/api/room-functor/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromId: data.sourceDelib.id,
      toId: data.targetDelib.id,
      claimMap,
      depth: 1,
    })
  });
  
  if (!res1.ok) {
    console.error(`❌ FAILED: Preview depth=1 returned ${res1.status}`);
    return false;
  }
  
  const json1 = await res1.json();
  if (!json1.proposals || json1.proposals.length === 0) {
    console.error("❌ FAILED: No proposals returned for depth=1");
    return false;
  }
  
  const mainProposal1 = json1.proposals.find((p: any) => 
    p.fromArgumentId === data.mainArg.id
  );
  
  if (!mainProposal1) {
    console.error("❌ FAILED: Main argument not in proposals");
    return false;
  }
  
  if (mainProposal1.premiseCount !== undefined) {
    console.error("❌ FAILED: depth=1 should not include premiseCount");
    return false;
  }
  
  console.log("✅ depth=1 works (no premise metadata)");
  
  // Test depth=2 (with premise detection)
  console.log("Testing depth=2 (with premise detection)...");
  const res2 = await fetch("http://localhost:3000/api/room-functor/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromId: data.sourceDelib.id,
      toId: data.targetDelib.id,
      claimMap,
      depth: 2,
    })
  });
  
  if (!res2.ok) {
    console.error(`❌ FAILED: Preview depth=2 returned ${res2.status}`);
    return false;
  }
  
  const json2 = await res2.json();
  const mainProposal2 = json2.proposals.find((p: any) => 
    p.fromArgumentId === data.mainArg.id
  );
  
  if (!mainProposal2) {
    console.error("❌ FAILED: Main argument not in proposals for depth=2");
    return false;
  }
  
  if (mainProposal2.premiseCount !== 2) {
    console.error(`❌ FAILED: Expected premiseCount=2, got ${mainProposal2.premiseCount}`);
    return false;
  }
  
  if (!mainProposal2.premiseChain || mainProposal2.premiseChain.length !== 2) {
    console.error("❌ FAILED: premiseChain should have 2 items");
    return false;
  }
  
  console.log(`✅ depth=2 works (premiseCount=${mainProposal2.premiseCount})`);
  console.log(`   Premise chain: ${mainProposal2.premiseChain.join(", ")}`);
  console.log("");
  
  return true;
}

async function testRecursiveImport(data: Awaited<ReturnType<typeof setupTestData>>) {
  console.log("🧪 Test 3: Recursive Import with ArgumentEdge Creation\n");
  
  const claimMap: ClaimMapping = {
    [data.sourceClaim1.id]: data.targetClaim1.id,
    [data.sourceClaim2.id]: data.targetClaim2.id,
    [data.sourceClaim3.id]: data.targetClaim3.id,
  };
  
  // First get proposals with depth=2
  const previewRes = await fetch("http://localhost:3000/api/room-functor/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromId: data.sourceDelib.id,
      toId: data.targetDelib.id,
      claimMap,
      depth: 2,
    })
  });
  
  const preview = await previewRes.json();
  const mainProposal = preview.proposals.find((p: any) => 
    p.fromArgumentId === data.mainArg.id
  );
  
  if (!mainProposal) {
    console.error("❌ FAILED: Could not get preview for main argument");
    return false;
  }
  
  console.log("Applying import with depth=2...");
  
  // Apply import with depth=2
  const applyRes = await fetch("http://localhost:3000/api/room-functor/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromId: data.sourceDelib.id,
      toId: data.targetDelib.id,
      claimMap,
      proposals: [mainProposal],
      depth: 2,
      userId: TEST_USER_ID,
    })
  });
  
  if (!applyRes.ok) {
    console.error(`❌ FAILED: Apply returned ${applyRes.status}`);
    const text = await applyRes.text();
    console.error(`   Error: ${text}`);
    return false;
  }
  
  const applyResult = await applyRes.json();
  console.log(`✅ Apply result: applied=${applyResult.applied}, skipped=${applyResult.skipped}`);
  
  if (applyResult.applied !== 1) {
    console.error(`❌ FAILED: Expected 1 applied, got ${applyResult.applied}`);
    return false;
  }
  
  const importedArgId = applyResult.results[0]?.argumentId;
  if (!importedArgId) {
    console.error("❌ FAILED: No imported argument ID in results");
    return false;
  }
  
  console.log(`   Imported argument: ${importedArgId}`);
  
  // Check if ArgumentEdge records were created
  const edges = await prisma.argumentEdge.findMany({
    where: {
      toArgumentId: importedArgId,
      type: "support",
      deliberationId: data.targetDelib.id,
    }
  });
  
  console.log(`   ArgumentEdge records found: ${edges.length}`);
  
  if (edges.length === 0) {
    console.error("❌ FAILED: No ArgumentEdge records created for composition");
    return false;
  }
  
  console.log(`✅ Composition graph created with ${edges.length} edge(s)`);
  
  // Check if premise arguments were imported
  const premiseArgs = await prisma.argument.findMany({
    where: {
      id: {
        in: edges.map(e => e.fromArgumentId)
      },
      deliberationId: data.targetDelib.id,
    }
  });
  
  console.log(`   Premise arguments imported: ${premiseArgs.length}`);
  
  if (premiseArgs.length === 0) {
    console.error("❌ FAILED: Premise arguments were not imported");
    return false;
  }
  
  // Check if ArgumentDiagrams were created for imported premises
  for (const premiseArg of premiseArgs) {
    const node = await prisma.debateNode.findFirst({
      where: {
        argumentId: premiseArg.id,
        sheetId: data.targetDelib.id,
      },
      include: {
        diagram: {
          include: {
            statements: true,
            inferences: true,
          }
        }
      }
    });
    
    if (!node?.diagram) {
      console.error(`❌ FAILED: No diagram found for premise ${premiseArg.id}`);
      return false;
    }
    
    console.log(`   ✓ Premise ${premiseArg.id.slice(0, 8)} has diagram with ${node.diagram.statements.length} statements`);
  }
  
  console.log("✅ Structure preservation verified for all imported premises\n");
  
  return true;
}

async function main() {
  console.log("=" .repeat(60));
  console.log("CHUNK 5A Task 3.2: Composition Tracking Test Suite");
  console.log("=" .repeat(60) + "\n");
  
  try {
    // Cleanup first
    await cleanup();
    
    // Setup test data
    const data = await setupTestData();
    
    // Run tests
    const test1 = await testExtractStructure(data);
    const test2 = await testPreviewDepth(data);
    const test3 = await testRecursiveImport(data);
    
    // Summary
    console.log("=" .repeat(60));
    console.log("Test Summary:");
    console.log("=" .repeat(60));
    console.log(`Test 1 (Extract Structure):     ${test1 ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Test 2 (Preview Depth):         ${test2 ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Test 3 (Recursive Import):      ${test3 ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");
    
    if (test1 && test2 && test3) {
      console.log("🎉 All tests passed! Task 3.2 is complete.");
    } else {
      console.log("⚠️  Some tests failed. Please review the output above.");
    }
    
    // Cleanup after tests
    await cleanup();
    
  } catch (error) {
    console.error("❌ Test suite failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
