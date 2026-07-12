/**
 * Test script for dialogue move → ludic act mappings
 * Tests: ASSERT, WHY, GROUNDS, RETRACT, CONCEDE, THEREFORE, SUPPOSE, DISCHARGE
 */

import { prisma } from "@/lib/prismaclient";
import { compileFromMoves } from "@/packages/ludics-engine/compileFromMoves";

interface TestCase {
  name: string;
  moves: any[];
  expectedActs: {
    count: number;
    assertions: ((acts: any[]) => boolean)[];
  };
}

async function cleanup(deliberationId: string) {
  // Delete in correct order to respect foreign keys
  await prisma.ludicChronicle.deleteMany({ where: { design: { deliberationId } } });
  await prisma.ludicAct.deleteMany({ where: { design: { deliberationId } } });
  await prisma.ludicDesign.deleteMany({ where: { deliberationId } });
  await prisma.ludicLocus.deleteMany({ where: { dialogueId: deliberationId } });
  await prisma.dialogueMove.deleteMany({ where: { deliberationId } });
  await prisma.deliberation.deleteMany({ where: { id: deliberationId } });
}

async function runTest(testCase: TestCase) {
  const deliberationId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${testCase.name}`);
  console.log(`${"=".repeat(60)}`);
  
  try {
    // 1. Create deliberation
    const delib = await prisma.deliberation.create({
      data: {
        id: deliberationId,
        hostType: "site",
        hostId: "test-site",
        createdById: "test-user",
      },
    });
    console.log(`✓ Created deliberation: ${delib.id}`);

    // 2. Create root locus
    const rootLocus = await prisma.ludicLocus.create({
      data: {
        dialogueId: deliberationId,
        path: "0",
      },
    });
    console.log(`✓ Created root locus: ${rootLocus.id}`);

    // 3. Create designs
    const proDesign = await prisma.ludicDesign.create({
      data: {
        deliberationId,
        participantId: "Proponent",
        rootLocusId: rootLocus.id,
      },
    });
    const oppDesign = await prisma.ludicDesign.create({
      data: {
        deliberationId,
        participantId: "Opponent",
        rootLocusId: rootLocus.id,
      },
    });
    console.log(`✓ Created designs: ${proDesign.id}, ${oppDesign.id}`);

    // 4. Create moves
    for (const move of testCase.moves) {
      await prisma.dialogueMove.create({
        data: {
          deliberationId,
          targetType: move.targetType || "claim",
          targetId: move.targetId || "test-claim-1",
          kind: move.kind,
          payload: move.payload || {},
          actorId: move.actorId || "test-actor",
          signature: `${move.kind}:${Date.now()}:${Math.random()}`,
          polarity: move.polarity || null,
        },
      });
    }
    console.log(`✓ Created ${testCase.moves.length} moves`);

    // 5. Compile
    await compileFromMoves(deliberationId, { scopingStrategy: "legacy" });
    console.log(`✓ Compilation complete`);

    // 6. Fetch acts
    const acts = await prisma.ludicAct.findMany({
      where: { design: { deliberationId } },
      include: { locus: true },
      orderBy: { orderInDesign: "asc" },
    });
    console.log(`✓ Found ${acts.length} acts`);

    // 7. Run assertions
    console.log(`\nValidating assertions...`);
    let passedCount = 0;
    for (let i = 0; i < testCase.expectedActs.assertions.length; i++) {
      const assertion = testCase.expectedActs.assertions[i];
      try {
        const result = assertion(acts);
        if (result) {
          console.log(`  ✓ Assertion ${i + 1} passed`);
          passedCount++;
        } else {
          console.log(`  ✗ Assertion ${i + 1} FAILED`);
        }
      } catch (e: any) {
        console.log(`  ✗ Assertion ${i + 1} ERROR: ${e.message}`);
      }
    }

    // 8. Summary
    const passed = acts.length === testCase.expectedActs.count && 
                   passedCount === testCase.expectedActs.assertions.length;
    
    if (passed) {
      console.log(`\n✅ TEST PASSED: ${testCase.name}`);
    } else {
      console.log(`\n❌ TEST FAILED: ${testCase.name}`);
      console.log(`   Expected ${testCase.expectedActs.count} acts, got ${acts.length}`);
      console.log(`   Passed ${passedCount}/${testCase.expectedActs.assertions.length} assertions`);
    }

    // 9. Print act details for debugging
    console.log(`\nAct Details:`);
    acts.forEach((act, i) => {
      console.log(`  [${i}] ${act.kind} ${act.polarity || ""} at ${act.locus?.path || "?"}`);
      console.log(`      expr: ${act.expression?.slice(0, 50)}${(act.expression?.length || 0) > 50 ? "..." : ""}`);
      console.log(`      meta: ${JSON.stringify(act.metaJson || {})}`);
    });

    return passed;
  } catch (error: any) {
    console.error(`\n❌ TEST ERROR: ${error.message}`);
    console.error(error.stack);
    return false;
  } finally {
    await cleanup(deliberationId);
    console.log(`\n✓ Cleanup complete\n`);
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

const tests: TestCase[] = [
  // Test 1: ASSERT creates P act at top-level locus
  {
    name: "ASSERT - Basic assertion",
    moves: [
      {
        kind: "ASSERT",
        payload: { text: "Climate change is real" },
      },
    ],
    expectedActs: {
      count: 1,
      assertions: [
        (acts) => acts[0].kind === "PROPER",
        (acts) => acts[0].polarity === "P",
        (acts) => acts[0].locus?.path.startsWith("0."),
      ],
    },
  },

  // Test 2: WHY creates O act as child
  {
    name: "WHY - Challenge assertion",
    moves: [
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "Climate change is real" },
      },
      {
        kind: "WHY",
        targetId: "claim-1",
        payload: { text: "What's your evidence?" },
      },
    ],
    expectedActs: {
      count: 2,
      assertions: [
        (acts) => acts[0].kind === "PROPER" && acts[0].polarity === "P",
        (acts) => acts[1].kind === "PROPER" && acts[1].polarity === "O",
        (acts) => {
          const assertLocus = acts[0].locus?.path;
          const whyLocus = acts[1].locus?.path;
          return whyLocus?.startsWith(assertLocus + ".") || false;
        },
      ],
    },
  },

  // Test 3: GROUNDS creates P act as child of WHY
  {
    name: "GROUNDS - Answer challenge",
    moves: [
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "Climate change is real" },
      },
      {
        kind: "WHY",
        targetId: "claim-1",
        payload: { text: "What's your evidence?" },
      },
      {
        kind: "GROUNDS",
        targetId: "claim-1",
        payload: { text: "IPCC reports show warming trends" },
      },
    ],
    expectedActs: {
      count: 3,
      assertions: [
        (acts) => acts[0].polarity === "P" && acts[0].kind === "PROPER",
        (acts) => acts[1].polarity === "O" && acts[1].kind === "PROPER",
        (acts) => acts[2].polarity === "P" && acts[2].kind === "PROPER",
        (acts) => {
          const whyLocus = acts[1].locus?.path;
          const groundsLocus = acts[2].locus?.path;
          return groundsLocus?.startsWith(whyLocus + ".") || false;
        },
      ],
    },
  },

  // Test 4: RETRACT creates P act + DAIMON
  {
    name: "RETRACT - Withdraw claim",
    moves: [
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "Nuclear is always safe" },
      },
      {
        kind: "RETRACT",
        targetId: "claim-1",
        payload: { text: "I retract this claim" },
      },
    ],
    expectedActs: {
      count: 3, // ASSERT (P) + RETRACT (P) + DAIMON
      assertions: [
        (acts) => acts[0].kind === "PROPER" && acts[0].polarity === "P",
        (acts) => acts[1].kind === "PROPER" && acts[1].polarity === "P",
        (acts) => acts[2].kind === "DAIMON",
        (acts) => acts[2].expression === "RETRACT",
      ],
    },
  },

  // Test 5: CONCEDE creates P act (no DAIMON)
  {
    name: "CONCEDE - Acknowledge opponent's point",
    moves: [
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "Solar is expensive" },
      },
      {
        kind: "WHY",
        targetId: "claim-1",
        payload: { text: "What about recent cost drops?" },
      },
      {
        kind: "CONCEDE",
        targetId: "claim-1",
        payload: { text: "You're right, costs have dropped" },
      },
    ],
    expectedActs: {
      count: 3, // ASSERT (P) + WHY (O) + CONCEDE (P)
      assertions: [
        (acts) => acts[0].kind === "PROPER" && acts[0].polarity === "P",
        (acts) => acts[1].kind === "PROPER" && acts[1].polarity === "O",
        (acts) => acts[2].kind === "PROPER" && acts[2].polarity === "P",
        (acts) => acts[2].expression?.includes("CONCEDE") || acts[2].expression?.includes("right"),
        (acts) => !acts.some(a => a.kind === "DAIMON"), // No daimon for CONCEDE
      ],
    },
  },

  // Test 6: THEREFORE creates inference
  {
    name: "THEREFORE - Draw conclusion",
    moves: [
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "CO2 traps heat" },
      },
      {
        kind: "ASSERT",
        targetId: "claim-2",
        payload: { text: "CO2 levels are rising" },
      },
      {
        kind: "THEREFORE",
        targetId: "claim-3",
        payload: { 
          text: "Temperature will increase",
          inferenceRule: "modus_ponens",
        },
      },
    ],
    expectedActs: {
      count: 3, // Two ASSERTs + THEREFORE
      assertions: [
        (acts) => acts[0].kind === "PROPER" && acts[0].polarity === "P",
        (acts) => acts[1].kind === "PROPER" && acts[1].polarity === "P",
        (acts) => acts[2].kind === "PROPER" && acts[2].polarity === "P",
        (acts) => {
          const meta = acts[2].metaJson as any;
          return meta?.inferenceRule === "modus_ponens";
        },
      ],
    },
  },

  // Test 7: SUPPOSE opens hypothetical scope
  {
    name: "SUPPOSE - Hypothetical reasoning",
    moves: [
      {
        kind: "SUPPOSE",
        targetId: "hypothesis-1",
        payload: { text: "Suppose carbon tax is implemented" },
      },
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "Emissions would decrease" },
      },
    ],
    expectedActs: {
      count: 2,
      assertions: [
        (acts) => acts[0].kind === "PROPER" && acts[0].polarity === "P",
        (acts) => {
          const meta = acts[0].metaJson as any;
          return meta?.hypothetical === true;
        },
        (acts) => acts[1].kind === "PROPER" && acts[1].polarity === "P",
      ],
    },
  },

  // Test 8: DISCHARGE closes hypothetical
  {
    name: "DISCHARGE - Close hypothesis",
    moves: [
      {
        kind: "SUPPOSE",
        targetId: "hypothesis-1",
        payload: { text: "Suppose carbon tax is implemented" },
      },
      {
        kind: "ASSERT",
        targetId: "claim-1",
        payload: { text: "Emissions would decrease" },
      },
      {
        kind: "DISCHARGE",
        targetId: "hypothesis-1",
        payload: { text: "Therefore tax would be effective" },
      },
    ],
    expectedActs: {
      count: 4, // SUPPOSE (P) + ASSERT (P) + DISCHARGE (P) + DAIMON
      assertions: [
        (acts) => acts[0].kind === "PROPER", // SUPPOSE
        (acts) => acts[1].kind === "PROPER", // ASSERT
        (acts) => acts[2].kind === "PROPER", // DISCHARGE
        (acts) => acts[3].kind === "DAIMON", // End hypothesis
        (acts) => acts[3].expression === "HYPOTHESIS_DISCHARGED",
      ],
    },
  },
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n");
  console.log("━".repeat(70));
  console.log("  DIALOGUE MOVE → LUDIC ACT MAPPING TEST SUITE");
  console.log("━".repeat(70));
  
  const results: boolean[] = [];
  
  for (const test of tests) {
    const passed = await runTest(test);
    results.push(passed);
  }
  
  // Final summary
  console.log("\n");
  console.log("━".repeat(70));
  console.log("  FINAL RESULTS");
  console.log("━".repeat(70));
  
  const passCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  console.log(`\nPassed: ${passCount}/${totalCount} tests`);
  
  if (passCount === totalCount) {
    console.log("\n🎉 ALL TESTS PASSED! 🎉\n");
  } else {
    console.log("\n⚠️  SOME TESTS FAILED\n");
    results.forEach((passed, i) => {
      const icon = passed ? "✅" : "❌";
      console.log(`  ${icon} ${tests[i].name}`);
    });
    console.log("");
  }
  
  await prisma.$disconnect();
  process.exit(passCount === totalCount ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
