/**
 * Seed Script: DDS Test Data via DialogueMoves
 * 
 * Creates DialogueMove records that the Ludics compiler will process
 * into designs, acts, disputes, etc.
 * 
 * Run with: npx tsx scripts/seed-dds-moves.ts
 * 
 * Target deliberation: cmgn1qrf00004pwnjqtbebhdg
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DELIBERATION_ID = "cmgn1qrf00004pwnjqtbebhdg";

async function main() {
  console.log("🌱 Starting DDS Move Seed...");
  console.log(`📍 Target Deliberation: ${DELIBERATION_ID}`);

  try {
    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: DELIBERATION_ID },
    });

    if (!deliberation) {
      console.error(`❌ Deliberation ${DELIBERATION_ID} not found!`);
      process.exit(1);
    }

    console.log(`✅ Found deliberation: "${deliberation.title}"`);

    // Check for existing moves
    const existingMoves = await prisma.dialogueMove.count({
      where: { deliberationId: DELIBERATION_ID },
    });

    if (existingMoves > 0) {
      console.log(`⚠️ Found ${existingMoves} existing moves. Skipping seed to avoid duplicates.`);
      console.log("   To re-seed, first delete existing moves or use a fresh deliberation.");
      return;
    }

    // =========================================================================
    // Create DialogueMoves that will compile into designs
    // =========================================================================
    console.log("\n📝 Creating dialogue moves...");

    const moves = [];

    // Move 1: Proponent asserts main thesis
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "ASSERT",
        actorId: "Proponent",
        polarity: "P",
        targetType: "argument",
        targetId: `arg-main-${Date.now()}`,
        signature: `seed-assert-main-${Date.now()}`,
        payload: {
          text: "Climate change requires immediate policy action",
          locusPath: "0.1",
          ramification: ["1", "2"],
          acts: [
            {
              polarity: "pos",
              locusPath: "0",
              expression: "Climate change requires immediate policy action",
              openings: ["0.1", "0.2"],
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 1: Main thesis assertion");

    // Move 2: Opponent challenges with WHY
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "WHY",
        actorId: "Opponent",
        polarity: "O",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-why-1-${Date.now()}`,
        payload: {
          text: "WHY: What evidence supports immediate action?",
          locusPath: "0.1",
          acts: [
            {
              polarity: "neg",
              locusPath: "0.1",
              expression: "WHY: What evidence supports immediate action?",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 2: Opponent WHY challenge");

    // Move 3: Proponent provides GROUNDS
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "GROUNDS",
        actorId: "Proponent",
        polarity: "P",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-grounds-1-${Date.now()}`,
        payload: {
          text: "Scientific consensus supports anthropogenic causes",
          locusPath: "0.1.1",
          acts: [
            {
              polarity: "pos",
              locusPath: "0.1",
              expression: "Scientific consensus supports anthropogenic causes",
              openings: ["0.1.1"],
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 3: Proponent GROUNDS - scientific consensus");

    // Move 4: Opponent challenges the evidence
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "WHY",
        actorId: "Opponent",
        polarity: "O",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-why-2-${Date.now()}`,
        payload: {
          text: "WHY: How reliable is the scientific consensus?",
          locusPath: "0.1.1",
          acts: [
            {
              polarity: "neg",
              locusPath: "0.1.1",
              expression: "WHY: How reliable is the scientific consensus?",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 4: Opponent challenges consensus reliability");

    // Move 5: Proponent defends with specific evidence
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "GROUNDS",
        actorId: "Proponent",
        polarity: "P",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-grounds-2-${Date.now()}`,
        payload: {
          text: "97% of climate scientists agree on human causes",
          locusPath: "0.1.1.1",
          acts: [
            {
              polarity: "pos",
              locusPath: "0.1.1",
              expression: "97% of climate scientists agree on human causes",
              openings: ["0.1.1.1", "0.1.1.2"],
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 5: Proponent cites 97% consensus");

    // Move 6: Opponent attacks methodology
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "WHY",
        actorId: "Opponent",
        polarity: "O",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-why-3-${Date.now()}`,
        payload: {
          text: "Consensus studies have methodological issues",
          locusPath: "0.1.1.1",
          acts: [
            {
              polarity: "neg",
              locusPath: "0.1.1.1",
              expression: "Consensus studies have methodological issues",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 6: Opponent attacks methodology");

    // Move 7: Proponent defends methodology
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "GROUNDS",
        actorId: "Proponent",
        polarity: "P",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-grounds-3-${Date.now()}`,
        payload: {
          text: "Consensus methodology is robust and peer-reviewed",
          locusPath: "0.1.1.2",
          acts: [
            {
              polarity: "pos",
              locusPath: "0.1.1.2",
              expression: "Consensus methodology is robust and peer-reviewed",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 7: Proponent defends methodology");

    // Move 8: Proponent adds alternative evidence branch
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "GROUNDS",
        actorId: "Proponent",
        polarity: "P",
        targetType: "argument",
        targetId: moves[0].targetId,
        signature: `seed-grounds-4-${Date.now()}`,
        payload: {
          text: "Observable temperature trends confirm models",
          locusPath: "0.1.2",
          acts: [
            {
              polarity: "pos",
              locusPath: "0.1.2",
              expression: "Observable temperature trends confirm models",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 8: Proponent adds temperature evidence");

    // Move 9: Alternative argument thread - cost-benefit
    const altArgId = `arg-alt-${Date.now()}`;
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "ASSERT",
        actorId: "Proponent",
        polarity: "P",
        targetType: "argument",
        targetId: altArgId,
        signature: `seed-assert-alt-${Date.now()}`,
        payload: {
          text: "Economic benefits outweigh transition costs",
          locusPath: "0.2",
          acts: [
            {
              polarity: "pos",
              locusPath: "0.2",
              expression: "Economic benefits outweigh transition costs",
              openings: ["0.2.1"],
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 9: Alternative argument - economic benefits");

    // Move 10: Opponent challenges cost-benefit
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "WHY",
        actorId: "Opponent",
        polarity: "O",
        targetType: "argument",
        targetId: altArgId,
        signature: `seed-why-alt-${Date.now()}`,
        payload: {
          text: "WHY: What cost-benefit analysis supports this?",
          locusPath: "0.2",
          acts: [
            {
              polarity: "neg",
              locusPath: "0.2",
              expression: "WHY: What cost-benefit analysis supports this?",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 10: Opponent challenges cost-benefit");

    // Move 11: Opponent concedes on alternative interpretation
    moves.push(await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        kind: "CONCEDE",
        actorId: "Opponent",
        polarity: "O",
        targetType: "argument",
        targetId: moves[0].targetId,
        endsWithDaimon: false,
        signature: `seed-concede-${Date.now()}`,
        payload: {
          text: "† (concedes alternative interpretation)",
          locusPath: "0.3",
          acts: [
            {
              polarity: "daimon",
              locusPath: "0.3",
              expression: "† (concedes alternative interpretation)",
            },
          ],
        },
      },
    }));
    console.log("   ✅ Move 11: Opponent concedes (daimon)");

    console.log(`\n✅ Created ${moves.length} dialogue moves`);

    // =========================================================================
    // Summary
    // =========================================================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ MOVE SEED COMPLETE!");
    console.log("=".repeat(60));
    console.log(`
📊 Summary:
   - Dialogue Moves: ${moves.length}
   - Main argument thread: 8 moves
   - Alternative argument thread: 2 moves
   - Concession: 1 move

🔧 Next Steps:
   1. Go to the Ludics tab in the deliberation
   2. Click "Compile" to generate designs from moves
   3. The DDS Analysis Panel should show the compiled data

🎯 Expected after compilation:
   - 4 designs (2 per scope: Proponent + Opponent)
   - ~11 acts across designs
   - 2 scopes (Main Thesis + Alternative Argument)
`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
