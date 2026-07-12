/**
 * Seed Script: Commitment System Features Test
 * 
 * Purpose: Create test data for deliberation "ludics-forest-demo" to demonstrate:
 * - Participant Agreement Matrix (with shared claims)
 * - Contradiction Detection
 * - Commitment Store tracking
 * - Promotion to Ludics system
 * 
 * This script creates:
 * - Multiple participants committing to the same claims
 * - Some contradictory commitments
 * - Retractions
 * - Concessions between participants
 */

import { prisma } from "../lib/prismaclient";
import { invalidateCommitmentStoresCache } from "../lib/aif/graph-builder";

const DELIBERATION_ID = "ludics-forest-demo";

// Test participants
const PARTICIPANTS = [
  { id: "test-alice", name: "Alice" },
  { id: "test-bob", name: "Bob" },
  { id: "test-carol", name: "Carol" },
];

// Shared claims that multiple participants will commit to
const SHARED_CLAIMS = [
  { id: "claim-climate-change", text: "Climate change is caused primarily by human activity" },
  { id: "claim-renewable-energy", text: "Renewable energy can replace fossil fuels by 2050" },
  { id: "claim-carbon-tax", text: "Carbon taxes are an effective policy tool" },
  { id: "claim-nuclear-safe", text: "Nuclear energy is safe with modern technology" },
  { id: "claim-ev-adoption", text: "Electric vehicle adoption will reduce emissions significantly" },
];

// Contradictory pairs for testing contradiction detection
const CONTRADICTORY_CLAIMS = [
  { 
    positive: { id: "claim-positive-1", text: "Wind power is cost-effective" },
    negative: { id: "claim-negative-1", text: "Wind power is not cost-effective" }
  },
  {
    positive: { id: "claim-positive-2", text: "Solar panels are economically viable" },
    negative: { id: "claim-negative-2", text: "Solar panels are not economically viable" }
  },
];

async function main() {
  console.log("\n🌱 Seeding Commitment System Test Data");
  console.log(`📋 Deliberation: ${DELIBERATION_ID}\n`);

  // Verify deliberation exists
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: DELIBERATION_ID },
    select: { id: true, title: true },
  });

  if (!deliberation) {
    console.error(`❌ Deliberation ${DELIBERATION_ID} not found`);
    process.exit(1);
  }

  console.log(`✅ Found deliberation: ${deliberation.title}\n`);

  // Step 1: Create shared claims
  console.log("📝 Step 1: Creating shared claims...\n");

  const claimIds: Record<string, string> = {};

  for (const claimData of [...SHARED_CLAIMS, ...CONTRADICTORY_CLAIMS.flatMap(p => [p.positive, p.negative])]) {
    const existing = await prisma.claim.findFirst({
      where: {
        deliberationId: DELIBERATION_ID,
        text: claimData.text,
      },
    });

    if (existing) {
      console.log(`   ⏭️  Claim already exists: "${claimData.text.substring(0, 50)}..."`);
      claimIds[claimData.id] = existing.id;
    } else {
      const claim = await prisma.claim.create({
        data: {
          deliberationId: DELIBERATION_ID,
          text: claimData.text,
          // Use first participant as creator
          createdById: PARTICIPANTS[0].id,
          moid: `test-claim-${claimData.id}`,
        },
      });
      claimIds[claimData.id] = claim.id;
      console.log(`   ✅ Created: "${claimData.text.substring(0, 50)}..."`);
    }
  }

  console.log(`\n✅ Created/verified ${Object.keys(claimIds).length} claims\n`);

  // Step 2: Create DialogueMoves for commitment tracking
  console.log("🎭 Step 2: Creating DialogueMoves for commitment tracking...\n");

  let moveCount = 0;

  // Alice asserts 4 shared claims
  console.log("   Alice's commitments:");
  for (const claimKey of ["claim-climate-change", "claim-renewable-energy", "claim-carbon-tax", "claim-nuclear-safe"]) {
    const move = await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        actorId: PARTICIPANTS[0].id,
        kind: "ASSERT",
        targetType: "claim",
        targetId: claimIds[claimKey],
        signature: `test-assert-${PARTICIPANTS[0].id}-${claimKey}`,
        payload: {},
      },
    });
    moveCount++;
    console.log(`      ✅ ASSERT: "${SHARED_CLAIMS.find(c => c.id === claimKey)?.text.substring(0, 40)}..."`);
  }

  // Bob asserts 3 of the same claims (overlap with Alice)
  console.log("\n   Bob's commitments:");
  for (const claimKey of ["claim-climate-change", "claim-renewable-energy", "claim-ev-adoption"]) {
    const move = await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        actorId: PARTICIPANTS[1].id,
        kind: "ASSERT",
        targetType: "claim",
        targetId: claimIds[claimKey],
        signature: `test-assert-${PARTICIPANTS[1].id}-${claimKey}`,
        payload: {},
      },
    });
    moveCount++;
    console.log(`      ✅ ASSERT: "${SHARED_CLAIMS.find(c => c.id === claimKey)?.text.substring(0, 40)}..."`);
  }

  // Carol concedes to 2 claims (demonstrates CONCEDE)
  console.log("\n   Carol's commitments:");
  for (const claimKey of ["claim-climate-change", "claim-carbon-tax"]) {
    const move = await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIBERATION_ID,
        actorId: PARTICIPANTS[2].id,
        kind: "CONCEDE",
        targetType: "claim",
        targetId: claimIds[claimKey],
        signature: `test-concede-${PARTICIPANTS[2].id}-${claimKey}`,
        payload: {},
      },
    });
    moveCount++;
    console.log(`      ✅ CONCEDE: "${SHARED_CLAIMS.find(c => c.id === claimKey)?.text.substring(0, 40)}..."`);
  }

  console.log(`\n✅ Created ${moveCount} DialogueMoves with shared commitments\n`);

  // Step 3: Create contradictory commitments for testing
  console.log("⚡ Step 3: Creating contradictory commitments...\n");

  // Alice asserts positive claim
  const contradictMove1 = await prisma.dialogueMove.create({
    data: {
      deliberationId: DELIBERATION_ID,
      actorId: PARTICIPANTS[0].id,
      kind: "ASSERT",
      targetType: "claim",
      targetId: claimIds["claim-positive-1"],
      signature: `test-contradict-alice-pos`,
      payload: {},
    },
  });
  console.log(`   Alice ASSERT: "${CONTRADICTORY_CLAIMS[0].positive.text}"`);

  // Alice also asserts the negation (contradiction!)
  const contradictMove2 = await prisma.dialogueMove.create({
    data: {
      deliberationId: DELIBERATION_ID,
      actorId: PARTICIPANTS[0].id,
      kind: "ASSERT",
      targetType: "claim",
      targetId: claimIds["claim-negative-1"],
      signature: `test-contradict-alice-neg`,
      payload: {},
      createdAt: new Date(Date.now() + 1000), // 1 second later
    },
  });
  console.log(`   Alice ASSERT: "${CONTRADICTORY_CLAIMS[0].negative.text}"`);
  console.log("   ⚠️  This creates a contradiction for Alice!\n");

  // Step 4: Create a retraction
  console.log("🔄 Step 4: Creating retraction example...\n");

  // Bob retracts his commitment to EV adoption
  const retractionMove = await prisma.dialogueMove.create({
    data: {
      deliberationId: DELIBERATION_ID,
      actorId: PARTICIPANTS[1].id,
      kind: "RETRACT",
      targetType: "claim",
      targetId: claimIds["claim-ev-adoption"],
      signature: `test-retract-bob-ev`,
      payload: {},
      createdAt: new Date(Date.now() + 2000), // 2 seconds later
    },
  });
  console.log(`   Bob RETRACT: "${SHARED_CLAIMS.find(c => c.id === "claim-ev-adoption")?.text}"`);
  console.log("   ℹ️  Bob's commitment to this claim is now inactive\n");

  // Step 5: Invalidate cache
  console.log("🔄 Step 5: Invalidating commitment stores cache...\n");
  await invalidateCommitmentStoresCache(DELIBERATION_ID);
  console.log("   ✅ Cache invalidated\n");

  // Step 6: Summary
  console.log("📊 Summary:\n");
  
  const allMoves = await prisma.dialogueMove.count({
    where: { deliberationId: DELIBERATION_ID },
  });

  const testMoves = await prisma.dialogueMove.count({
    where: {
      deliberationId: DELIBERATION_ID,
      actorId: { in: PARTICIPANTS.map(p => p.id) },
    },
  });

  console.log(`   Total DialogueMoves in deliberation: ${allMoves}`);
  console.log(`   Test moves created: ${testMoves}`);
  console.log(`   Test participants: ${PARTICIPANTS.length}`);
  console.log(`   Shared claims: ${SHARED_CLAIMS.length}`);
  console.log(`   Contradictory pairs: ${CONTRADICTORY_CLAIMS.length}\n`);

  console.log("🎯 Expected Results:\n");
  console.log("   📈 Participant Agreement Matrix:");
  console.log("      - Alice ↔ Bob: ~40-50% agreement (2-3 shared claims)");
  console.log("      - Alice ↔ Carol: ~33% agreement (2 shared claims)");
  console.log("      - Bob ↔ Carol: ~33-50% agreement (1 shared claim after Bob's retraction)\n");
  
  console.log("   ⚡ Contradiction Detection:");
  console.log("      - Alice has 1 contradiction (wind power positive/negative)\n");
  
  console.log("   🔄 Retraction Analysis:");
  console.log("      - Bob retracted 1 commitment (EV adoption)\n");
  
  console.log("   👥 Commitment Stores:");
  console.log("      - Alice: 6 active commitments (including contradiction)");
  console.log("      - Bob: 2 active commitments (after retraction)");
  console.log("      - Carol: 2 active commitments (CONCEDEs)\n");

  console.log("✨ Seed complete! Visit the Commitment Analytics Dashboard to see results.\n");
  console.log(`   URL: /deliberations/${DELIBERATION_ID}/analytics\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
