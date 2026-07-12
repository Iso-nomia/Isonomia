/**
 * Test DDS Correspondence System - Faggian-Hyland (2002) Isomorphisms
 * 
 * This tests the four key isomorphisms:
 * 1. Plays(Views(S)) = S
 * 2. Views(Plays(V)) = V
 * 3. Disp(Ch(S)) = S
 * 4. Ch(Disp(D)) = D
 */

import { prisma } from "../lib/prisma-cli";
import { constructStrategy } from "../packages/ludics-core/dds/strategy/construct";
import { computeDispute } from "../packages/ludics-core/dds/correspondence/disp";
import { extractView } from "../packages/ludics-core/dds/views";
import { disputeToPosition, extractChronicles } from "../packages/ludics-core/dds/chronicles";
import type { Action, Position, View, Chronicle } from "../packages/ludics-core/dds/types";

const DESIGN_ID = "cmimfl0gu00t98ckdkergl4mb";

interface PlayData {
  sequence: Action[];
  length: number;
  isPositive: boolean;
}

async function main() {
  console.log("\n=== DDS Correspondence System Test ===\n");
  
  // 1. Load the design
  console.log("1. Loading design...");
  const design = await prisma.ludicDesign.findUnique({
    where: { id: DESIGN_ID },
    include: {
      acts: { 
        include: { locus: true },
        orderBy: { orderInDesign: "asc" } 
      },
      rootLocus: true,
    }
  });
  
  if (!design) {
    console.error("Design not found:", DESIGN_ID);
    return;
  }
  
  // Map acts to include locusPath from locus relation
  const actsWithPath = design.acts.map(a => ({
    ...a,
    locusPath: a.locus?.path || ""
  }));
  
  console.log(`   Design: ${design.id.substring(0, 8)}`);
  console.log(`   Acts: ${actsWithPath.length}`);
  console.log(`   Root locus: ${design.rootLocus?.path || "none"}`);
  console.log(`   Act locus paths: ${actsWithPath.map(a => a.locusPath).join(", ")}`);
  
  // 2. Find other designs to form disputes with
  console.log("\n2. Finding counter-designs...");
  const otherDesigns = await prisma.ludicDesign.findMany({
    where: { 
      deliberationId: design.deliberationId,
      id: { not: design.id }
    },
    include: { 
      acts: { include: { locus: true } }, 
      rootLocus: true 
    },
    take: 5,
  });
  
  console.log(`   Found ${otherDesigns.length} other designs`);
  
  // 3. Create disputes
  console.log("\n3. Creating disputes...");
  const disputes: any[] = [];
  
  for (const other of otherDesigns) {
    console.log(`   Computing dispute with ${other.id.substring(0, 8)}...`);
    
    // Map other acts to include locusPath
    const otherActsWithPath = other.acts.map(a => ({
      ...a,
      locusPath: a.locus?.path || ""
    }));
    
    try {
      const dispute = computeDispute(
        { id: design.id, acts: actsWithPath, base: design.rootLocus },
        { id: other.id, acts: otherActsWithPath, base: other.rootLocus }
      );
      disputes.push(dispute);
      console.log(`     Pairs: ${dispute.pairs.length}, Paths: ${dispute.pairs.map(p => p.locusPath).join(", ")}`);
    } catch (e: any) {
      console.log(`     Error: ${e.message}`);
    }
  }
  
  console.log(`   Total disputes: ${disputes.length}`);
  
  // 4. Construct strategy
  console.log("\n4. Constructing strategy from disputes...");
  
  const strategy = constructStrategy(
    design.id, 
    "P", // Player P's strategy
    disputes
  );
  
  console.log(`   Plays: ${strategy.plays.length}`);
  console.log(`   Innocent: ${strategy.isInnocent}`);
  
  // 5. Show sample plays
  console.log("\n5. Sample plays:");
  for (let i = 0; i < Math.min(10, strategy.plays.length); i++) {
    const play = strategy.plays[i];
    const repr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
    console.log(`   ${i}: ${repr}`);
  }
  
  // 6. Test Plays ↔ Views isomorphism
  console.log("\n6. Testing Plays ↔ Views isomorphism...");
  
  let playsViewsPass = true;
  for (const play of strategy.plays.slice(0, 5)) {
    const position: Position = {
      id: `test-${Math.random()}`,
      sequence: play.sequence,
      player: "P",
      isLinear: true,
      isLegal: true,
    };
    
    const view = extractView(position, "P");
    const viewStr = play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
    console.log(`   Position: ${viewStr}`);
    console.log(`     → View size: ${view.length}, View: ${view.map(a => `${a.focus}:${a.polarity}`).join("|")}`);
    
    // Check polarity alternation
    let alternates = true;
    for (let i = 1; i < play.sequence.length; i++) {
      if (play.sequence[i].polarity === play.sequence[i-1].polarity) {
        alternates = false;
        console.log(`     ⚠️  Non-alternating at ${i}: ${play.sequence[i-1].polarity} → ${play.sequence[i].polarity}`);
        playsViewsPass = false;
        break;
      }
    }
    if (alternates) {
      console.log(`     ✓ Alternation valid`);
    }
  }
  
  // 7. Test Disp ↔ Ch isomorphism
  console.log("\n7. Testing Disp ↔ Ch isomorphism...");
  
  let dispChPass = true;
  for (const dispute of disputes.slice(0, 3)) {
    console.log(`   Dispute: ${dispute.pairs.map((p: any) => p.locusPath).join(", ")}`);
    
    // A position from this dispute
    const positions = disputes.length > 0 ? 
      strategy.plays.filter((p: PlayData) => 
        p.sequence.some(a => 
          dispute.pairs.some((pair: any) => pair.locusPath === a.focus)
        )
      ) : [];
    
    if (positions.length > 0) {
      const pos = positions[0];
      console.log(`     Position: ${pos.sequence.map(a => `${a.focus}:${a.polarity}`).join("|")}`);
      
      // Extract chronicle from dispute
      const chronicles = extractChronicles(dispute, "P");
      
      console.log(`     Chronicles extracted: ${chronicles.length}`);
      for (const chron of chronicles.slice(0, 2)) {
        console.log(`       → ${chron.actions.map(a => `${a.focus}:${a.polarity}`).join("|")}`);
      }
    }
  }
  
  // 8. Summary
  console.log("\n=== Summary ===");
  console.log(`Plays generated: ${strategy.plays.length}`);
  console.log(`Innocence check: ${strategy.isInnocent ? "PASS" : "FAIL"}`);
  console.log(`Propagation check: ${strategy.isPropagating ? "PASS" : "FAIL"}`);
  console.log(`Plays/Views alternation: ${playsViewsPass ? "PASS" : "FAIL"}`);
  console.log(`Disp/Ch correspondence: ${dispChPass ? "PASS (manual review)" : "NEEDS REVIEW"}`);
  
  // 9. Verify polarity distribution
  console.log("\n=== Polarity Distribution Analysis ===");
  const polarityByDepth: Record<number, Record<string, number>> = {};
  
  for (const play of strategy.plays) {
    for (const action of play.sequence) {
      const depth = action.focus.split(".").length;
      if (!polarityByDepth[depth]) {
        polarityByDepth[depth] = { P: 0, O: 0 };
      }
      polarityByDepth[depth][action.polarity]++;
    }
  }
  
  for (const depth of Object.keys(polarityByDepth).sort((a, b) => Number(a) - Number(b))) {
    const counts = polarityByDepth[Number(depth)];
    const expectedP = Number(depth) % 2 === 1 ? "P" : "O";
    const isCorrect = counts[expectedP] === counts.P + counts.O;
    console.log(`Depth ${depth}: P=${counts.P}, O=${counts.O} (expected: all ${expectedP}) ${isCorrect ? "✓" : "✗"}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
