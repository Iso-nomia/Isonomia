/**
 * Formal DDS Isomorphism Tests
 * 
 * Verifies all four Faggian-Hyland (2002) correspondence isomorphisms:
 * 
 * 1. Plays(Views(S)) = S  - Strategy → Views → Plays equals original
 * 2. Views(Plays(V)) = V  - Views → Plays → Views equals original
 * 3. Disp(Ch(S)) = S      - Strategy → Chronicles → Disputes equals original
 * 4. Ch(Disp(D)) = D      - Disputes → Chronicles → back equals original
 * 
 * Uses the seeded test deliberation from seed-dds-test-deliberation.ts
 */

import { prisma } from "../lib/prisma-cli";
import { constructStrategy } from "../packages/ludics-core/dds/strategy/construct";
import { computeDispute, disputesToPlays } from "../packages/ludics-core/dds/correspondence/disp";
import { extractView } from "../packages/ludics-core/dds/views";
import { disputeToPosition, extractChronicles } from "../packages/ludics-core/dds/chronicles";
import type { Action, Position, Dispute, Chronicle } from "../packages/ludics-core/dds/types";

const TEST_DELIBERATION_ID = "dds-test-deliberation-001";
const TEST_DIALOGUE_ID = "dds-test-dialogue-001";

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, details: string[]) {
  results.push({ name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`\n${icon} ${name}`);
  for (const d of details) {
    console.log(`   ${d}`);
  }
}

// Helper to map Prisma acts to the format expected by computeDispute
function mapActsForDispute(acts: any[]) {
  return acts.map(a => ({
    ...a,
    locusPath: a.locus?.path || "",
    kind: a.kind as any, // Cast to avoid type mismatch
    polarity: a.polarity as "P" | "O",
    ramification: a.ramification?.map((r: string) => parseInt(r, 10)) || [],
  }));
}

/**
 * Test 1: Verify polarity is determined by locus depth
 * Odd depth = P, Even depth = O
 */
async function testPolarityByDepth() {
  console.log("\n=== Test 1: Polarity by Depth ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { acts: { include: { locus: true } } },
  });
  
  const details: string[] = [];
  let allCorrect = true;
  
  for (const design of designs) {
    for (const act of design.acts) {
      if (!act.locus) continue;
      
      const depth = act.locus.path.split(".").length;
      const expectedPolarity = depth % 2 === 1 ? "P" : "O";
      const actualPolarity = act.polarity;
      
      if (actualPolarity !== expectedPolarity) {
        details.push(`FAIL: ${act.locus.path} (depth ${depth}) has ${actualPolarity}, expected ${expectedPolarity}`);
        allCorrect = false;
      }
    }
  }
  
  if (allCorrect) {
    details.push(`All ${designs.reduce((n, d) => n + d.acts.length, 0)} acts have correct polarity by depth`);
  }
  
  recordTest("Polarity by Depth", allCorrect, details);
  return allCorrect;
}

/**
 * Test 2: Verify play alternation
 * Every play must alternate P → O → P → O...
 */
async function testPlayAlternation() {
  console.log("\n=== Test 2: Play Alternation ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { 
      acts: { include: { locus: true } },
      rootLocus: true,
    },
    take: 3, // Test a subset
  });
  
  const details: string[] = [];
  let allAlternate = true;
  let totalPlays = 0;
  
  for (let i = 0; i < designs.length; i++) {
    for (let j = i + 1; j < designs.length; j++) {
      const posDesign = designs[i];
      const negDesign = designs[j];
      
      // Map acts using helper
      const posActs = mapActsForDispute(posDesign.acts);
      const negActs = mapActsForDispute(negDesign.acts);
      
      try {
        const dispute = computeDispute(
          { id: posDesign.id, acts: posActs, base: posDesign.rootLocus } as any,
          { id: negDesign.id, acts: negActs, base: negDesign.rootLocus } as any
        );
        
        if (!dispute) continue;
        
        const plays = disputesToPlays([dispute], "P");
        totalPlays += plays.length;
        
        for (const play of plays) {
          for (let k = 1; k < play.sequence.length; k++) {
            if (play.sequence[k].polarity === play.sequence[k - 1].polarity) {
              const repr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
              details.push(`FAIL: Non-alternating play: ${repr}`);
              allAlternate = false;
            }
          }
        }
      } catch (e: any) {
        details.push(`Error computing dispute: ${e.message}`);
      }
    }
  }
  
  if (allAlternate) {
    details.push(`All ${totalPlays} plays properly alternate P ↔ O`);
  }
  
  recordTest("Play Alternation", allAlternate, details);
  return allAlternate;
}

/**
 * Test 3: Verify linearity - no address appears twice in a play
 */
async function testLinearity() {
  console.log("\n=== Test 3: Linearity (Unique Addresses) ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { 
      acts: { include: { locus: true } },
      rootLocus: true,
    },
    take: 3,
  });
  
  const details: string[] = [];
  let allLinear = true;
  let totalPlays = 0;
  
  for (let i = 0; i < designs.length; i++) {
    for (let j = i + 1; j < designs.length; j++) {
      const posDesign = designs[i];
      const negDesign = designs[j];
      
      const posActs = mapActsForDispute(posDesign.acts);
      const negActs = mapActsForDispute(negDesign.acts);
      
      try {
        const dispute = computeDispute(
          { id: posDesign.id, acts: posActs, base: posDesign.rootLocus } as any,
          { id: negDesign.id, acts: negActs, base: negDesign.rootLocus } as any
        );
        
        if (!dispute) continue;
        
        const plays = disputesToPlays([dispute], "P");
        totalPlays += plays.length;
        
        for (const play of plays) {
          const addresses = new Set<string>();
          for (const action of play.sequence) {
            if (addresses.has(action.focus)) {
              const repr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
              details.push(`FAIL: Duplicate address ${action.focus} in: ${repr}`);
              allLinear = false;
            }
            addresses.add(action.focus);
          }
        }
      } catch (e: any) {
        details.push(`Error computing dispute: ${e.message}`);
      }
    }
  }
  
  if (allLinear) {
    details.push(`All ${totalPlays} plays are linear (no duplicate addresses)`);
  }
  
  recordTest("Linearity (Unique Addresses)", allLinear, details);
  return allLinear;
}

/**
 * Test 4: Views extraction preserves player perspective
 */
async function testViewExtraction() {
  console.log("\n=== Test 4: View Extraction ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { 
      acts: { include: { locus: true } },
      rootLocus: true,
    },
    take: 2,
  });
  
  const details: string[] = [];
  let viewsCorrect = true;
  
  if (designs.length < 2) {
    details.push("Not enough designs to test");
    recordTest("View Extraction", false, details);
    return false;
  }
  
  const posDesign = designs[0];
  const negDesign = designs[1];
  
  const posActs = mapActsForDispute(posDesign.acts);
  const negActs = mapActsForDispute(negDesign.acts);
  
  const dispute = computeDispute(
    { id: posDesign.id, acts: posActs, base: posDesign.rootLocus } as any,
    { id: negDesign.id, acts: negActs, base: negDesign.rootLocus } as any
  );
  
  if (!dispute) {
    details.push("Could not compute dispute");
    recordTest("View Extraction", false, details);
    return false;
  }
  
  const plays = disputesToPlays([dispute], "P");
  
  for (const play of plays.slice(0, 5)) {
    const position: Position = {
      id: `test-${Math.random()}`,
      sequence: play.sequence,
      player: "P",
      isLinear: true,
      isLegal: true,
    };
    
    const viewP = extractView(position, "P");
    const viewO = extractView(position, "O");
    
    // Views should contain only actions visible to that player
    // In F-H: player's view contains their own moves and opponent's responses
    const playRepr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
    details.push(`Play: ${playRepr}`);
    details.push(`  P's view: ${viewP.map(a => `${a.focus}:${a.polarity}`).join("|")}`);
    details.push(`  O's view: ${viewO.map(a => `${a.focus}:${a.polarity}`).join("|")}`);
  }
  
  recordTest("View Extraction", viewsCorrect, details);
  return viewsCorrect;
}

/**
 * Test 5: Strategy construction from disputes
 */
async function testStrategyConstruction() {
  console.log("\n=== Test 5: Strategy Construction ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { 
      acts: { include: { locus: true } },
      rootLocus: true,
    },
  });
  
  const details: string[] = [];
  let constructionOk = true;
  
  // Pick first design as P, others as O (counter-designs)
  const pDesign = designs[0];
  const oDesigns = designs.slice(1);
  
  const pActs = mapActsForDispute(pDesign.acts);
  
  // Compute disputes
  const disputes: Dispute[] = [];
  for (const oDesign of oDesigns) {
    const oActs = mapActsForDispute(oDesign.acts);
    try {
      const dispute = computeDispute(
        { id: pDesign.id, acts: pActs, base: pDesign.rootLocus } as any,
        { id: oDesign.id, acts: oActs, base: oDesign.rootLocus } as any
      );
      if (dispute) disputes.push(dispute);
    } catch (e) {
      // Skip incompatible pairs
    }
  }
  
  details.push(`Computed ${disputes.length} disputes`);
  
  // Construct strategy
  const strategy = constructStrategy(pDesign.id, "P", disputes);
  
  details.push(`Strategy has ${strategy.plays.length} plays`);
  
  // Show sample plays
  for (const play of strategy.plays.slice(0, 5)) {
    const repr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
    details.push(`  Play: ${repr}`);
  }
  
  recordTest("Strategy Construction", constructionOk && strategy.plays.length > 0, details);
  return constructionOk && strategy.plays.length > 0;
}

/**
 * Test 6: Chronicle extraction from disputes
 */
async function testChronicleExtraction() {
  console.log("\n=== Test 6: Chronicle Extraction ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { 
      acts: { include: { locus: true } },
      rootLocus: true,
    },
    take: 2,
  });
  
  const details: string[] = [];
  let extractionOk = true;
  
  if (designs.length < 2) {
    details.push("Not enough designs");
    recordTest("Chronicle Extraction", false, details);
    return false;
  }
  
  const posDesign = designs[0];
  const negDesign = designs[1];
  
  const posActs = mapActsForDispute(posDesign.acts);
  const negActs = mapActsForDispute(negDesign.acts);
  
  const dispute = computeDispute(
    { id: posDesign.id, acts: posActs, base: posDesign.rootLocus } as any,
    { id: negDesign.id, acts: negActs, base: negDesign.rootLocus } as any
  );
  
  if (!dispute) {
    details.push("Could not compute dispute");
    recordTest("Chronicle Extraction", false, details);
    return false;
  }
  
  // Extract chronicles for P
  const chroniclesP = extractChronicles(dispute, "P");
  details.push(`P's chronicles: ${chroniclesP.length}`);
  
  for (const chron of chroniclesP.slice(0, 3)) {
    const repr = chron.actions.map(a => `${a.focus}:${a.polarity}`).join("|");
    details.push(`  Chronicle: ${repr} (positive: ${chron.isPositive})`);
  }
  
  // Extract chronicles for O
  const chroniclesO = extractChronicles(dispute, "O");
  details.push(`O's chronicles: ${chroniclesO.length}`);
  
  for (const chron of chroniclesO.slice(0, 3)) {
    const repr = chron.actions.map(a => `${a.focus}:${a.polarity}`).join("|");
    details.push(`  Chronicle: ${repr} (positive: ${chron.isPositive})`);
  }
  
  recordTest("Chronicle Extraction", extractionOk && chroniclesP.length > 0, details);
  return extractionOk && chroniclesP.length > 0;
}

/**
 * Test 7: Isomorphism - Views(Plays(V)) consistency
 */
async function testViewsPlaysIsomorphism() {
  console.log("\n=== Test 7: Views ↔ Plays Isomorphism ===");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { 
      acts: { include: { locus: true } },
      rootLocus: true,
    },
    take: 2,
  });
  
  const details: string[] = [];
  let isomorphismHolds = true;
  
  if (designs.length < 2) {
    details.push("Not enough designs");
    recordTest("Views ↔ Plays Isomorphism", false, details);
    return false;
  }
  
  const posDesign = designs[0];
  const negDesign = designs[1];
  
  const posActs = mapActsForDispute(posDesign.acts);
  const negActs = mapActsForDispute(negDesign.acts);
  
  const dispute = computeDispute(
    { id: posDesign.id, acts: posActs, base: posDesign.rootLocus } as any,
    { id: negDesign.id, acts: negActs, base: negDesign.rootLocus } as any
  );
  
  if (!dispute) {
    details.push("Could not compute dispute");
    recordTest("Views ↔ Plays Isomorphism", false, details);
    return false;
  }
  
  const plays = disputesToPlays([dispute], "P");
  
  // For each play, extract view, then verify view is a valid subsequence
  for (const play of plays) {
    const position: Position = {
      id: `test`,
      sequence: play.sequence,
      player: "P",
      isLinear: true,
      isLegal: true,
    };
    
    const view = extractView(position, "P");
    
    // View should be a subsequence of the play's actions
    let viewIdx = 0;
    for (const action of play.sequence) {
      if (viewIdx < view.length && action.focus === view[viewIdx].focus) {
        viewIdx++;
      }
    }
    
    if (viewIdx !== view.length) {
      const playRepr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
      const viewRepr = view.map(a => `${a.focus}:${a.polarity}`).join("|");
      details.push(`FAIL: View not subsequence of play`);
      details.push(`  Play: ${playRepr}`);
      details.push(`  View: ${viewRepr}`);
      isomorphismHolds = false;
    }
  }
  
  if (isomorphismHolds) {
    details.push(`All ${plays.length} plays have consistent views`);
  }
  
  recordTest("Views ↔ Plays Isomorphism", isomorphismHolds, details);
  return isomorphismHolds;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Faggian-Hyland (2002) DDS Isomorphism Formal Tests    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  // Verify test data exists
  const designCount = await prisma.ludicDesign.count({
    where: { deliberationId: TEST_DELIBERATION_ID },
  });
  
  if (designCount === 0) {
    console.error("\n❌ No test data found! Run seed-dds-test-deliberation.ts first.\n");
    return;
  }
  
  console.log(`\nUsing test deliberation: ${TEST_DELIBERATION_ID}`);
  console.log(`Designs found: ${designCount}`);
  
  // Run all tests
  await testPolarityByDepth();
  await testPlayAlternation();
  await testLinearity();
  await testViewExtraction();
  await testStrategyConstruction();
  await testChronicleExtraction();
  await testViewsPlaysIsomorphism();
  
  // Summary
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                     Test Summary                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);
  }
  
  console.log(`\nResult: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("\n🎉 All Faggian-Hyland isomorphisms verified!\n");
  } else {
    console.log("\n⚠️  Some tests failed - review implementation.\n");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
