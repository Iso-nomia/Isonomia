/**
 * Test script for Commitment Promotion System (Phase 4 - Task 1)
 * 
 * Tests the end-to-end flow:
 * 1. Create a dialogue move (ASSERT)
 * 2. Promote the resulting commitment to Ludics
 * 3. Verify promotion status appears in commitment store query
 * 
 * Run with: npx tsx scripts/test-commitment-promotion.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Testing Commitment Promotion System\n");

  // Step 1: Find or create test data
  console.log("Step 1: Finding test deliberation...");
  const deliberation = await prisma.deliberation.findFirst({
    where: {},
  });

  if (!deliberation) {
    console.error("❌ No deliberation found. Create a test deliberation first.");
    process.exit(1);
  }

  console.log(`✅ Found deliberation: ${deliberation.id}\n`);

  // Step 2: Create or find a test claim
  console.log("Step 2: Creating test claim...");
  const claim = await prisma.claim.upsert({
    where: { id: "test-promotion-claim-001" },
    update: {},
    create: {
      id: "test-promotion-claim-001",
      text: "The commitment promotion system correctly bridges dialogue and ludics layers.",
      authorId: "system",
    },
  });

  console.log(`✅ Test claim: ${claim.text}\n`);

  // Step 3: Create a dialogue move (ASSERT)
  console.log("Step 3: Creating ASSERT move...");
  const move = await prisma.dialogueMove.create({
    data: {
      id: `test-promotion-move-${Date.now()}`,
      deliberationId: deliberation.id,
      actorId: "proponent",
      kind: "ASSERT",
      targetType: "claim",
      targetId: claim.id,
    },
  });

  console.log(`✅ Created move: ${move.id}`);
  console.log(`   Actor: ${move.actorId}, Kind: ${move.kind}\n`);

  // Step 4: Query commitment store BEFORE promotion
  console.log("Step 4: Querying commitment store (before promotion)...");
  const { getCommitmentStores } = await import("../lib/aif/graph-builder");
  const storesResultBefore = await getCommitmentStores(deliberation.id);
  const storesBefore = storesResultBefore.data;
  
  const proponentStore = storesBefore.find(
    (s: any) => s.participantId === "proponent"
  );
  if (!proponentStore) {
    console.error("❌ No commitment store found for proponent");
    process.exit(1);
  }

  const commitment = proponentStore.commitments.find(
    (c: any) => c.claimText === claim.text && c.isActive
  );

  if (!commitment) {
    console.error("❌ Commitment not found in store");
    process.exit(1);
  }

  console.log(`✅ Found commitment in store`);
  console.log(`   Promoted: ${commitment.isPromoted || false}`);
  console.log(`   Active: ${commitment.isActive}\n`);

  // Step 5: Create Ludic commitment element
  console.log("Step 5: Creating Ludic commitment element...");
  
  // First get or create a locus
  const locus = await prisma.ludicLocus.upsert({
    where: { id: "test-locus-0" },
    update: {},
    create: {
      id: "test-locus-0",
      path: "0",
      deliberationId: deliberation.id,
    },
  });

  // Get or create commitment state
  const commitmentState = await prisma.ludicCommitmentState.upsert({
    where: { id: `test-cs-${deliberation.id}` },
    update: {},
    create: {
      id: `test-cs-${deliberation.id}`,
      deliberationId: deliberation.id,
      currentLocusId: locus.id,
    },
  });

  const ludicElement = await prisma.ludicCommitmentElement.create({
    data: {
      id: `test-ludic-${Date.now()}`,
      ownerId: "opponent",
      basePolarity: "Fact",
      baseLocusId: locus.id,
      ludicCommitmentStateId: commitmentState.id,
    },
  });

  console.log(`✅ Created Ludic element: ${ludicElement.id}`);
  console.log(`   Owner: ${ludicElement.ownerId}, Polarity: ${ludicElement.basePolarity}\n`);

  // Step 6: Create promotion mapping
  console.log("Step 6: Creating CommitmentLudicMapping...");
  // @ts-ignore - commitmentLudicMapping exists at runtime, VS Code types may not be refreshed
  const mapping = await prisma.commitmentLudicMapping.create({
    data: {
      dialogueCommitmentId: move.id,
      ludicCommitmentElementId: ludicElement.id,
      deliberationId: deliberation.id,
      participantId: move.actorId,
      proposition: claim.text,
      ludicOwnerId: ludicElement.ownerId,
      ludicLocusId: locus.id,
      promotedBy: "system-test",
      promotionContext: {
        source: "test-script",
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log(`✅ Created mapping: ${mapping.id}`);
  console.log(`   Links: ${mapping.dialogueCommitmentId} → ${mapping.ludicCommitmentElementId}\n`);

  // Step 7: Query commitment store AFTER promotion (bypass cache)
  console.log("Step 7: Querying commitment store (after promotion)...");
  const storesResultAfter = await getCommitmentStores(deliberation.id);
  const storesAfter = storesResultAfter.data;
  
  const proponentStoreAfter = storesAfter.find(
    (s: any) => s.participantId === "proponent"
  );
  const commitmentAfter = proponentStoreAfter?.commitments.find(
    (c: any) => c.claimText === claim.text && c.isActive
  );

  if (!commitmentAfter) {
    console.error("❌ Commitment not found after promotion");
    process.exit(1);
  }

  console.log(`✅ Found commitment after promotion`);
  console.log(`   Promoted: ${commitmentAfter.isPromoted}`);
  console.log(`   Promoted At: ${commitmentAfter.promotedAt}`);
  console.log(`   Ludic Owner: ${commitmentAfter.ludicOwnerId}`);
  console.log(`   Ludic Polarity: ${commitmentAfter.ludicPolarity}\n`);

  // Step 8: Verify promotion data
  if (!commitmentAfter.isPromoted) {
    console.error("❌ FAIL: isPromoted should be true");
    process.exit(1);
  }

  if (!commitmentAfter.promotedAt) {
    console.error("❌ FAIL: promotedAt should be set");
    process.exit(1);
  }

  if (commitmentAfter.ludicOwnerId !== ludicElement.ownerId) {
    console.error(`❌ FAIL: ludicOwnerId mismatch (expected ${ludicElement.ownerId}, got ${commitmentAfter.ludicOwnerId})`);
    process.exit(1);
  }

  if (commitmentAfter.ludicPolarity !== ludicElement.basePolarity) {
    console.error(`❌ FAIL: ludicPolarity mismatch (expected ${ludicElement.basePolarity}, got ${commitmentAfter.ludicPolarity})`);
    process.exit(1);
  }

  // Cleanup
  console.log("Step 8: Cleaning up test data...");
  // @ts-ignore - commitmentLudicMapping exists at runtime
  await prisma.commitmentLudicMapping.delete({ where: { id: mapping.id } });
  await prisma.ludicCommitmentElement.delete({ where: { id: ludicElement.id } });
  await prisma.dialogueMove.delete({ where: { id: move.id } });
  console.log("✅ Test data cleaned up\n");

  console.log("🎉 ALL TESTS PASSED!");
  console.log("\nVerified features:");
  console.log("  ✓ SQL JOIN correctly fetches CommitmentLudicMapping data");
  console.log("  ✓ isPromoted flag populated from mapping existence");
  console.log("  ✓ promotedAt timestamp correctly formatted");
  console.log("  ✓ ludicOwnerId correctly populated from mapping");
  console.log("  ✓ ludicPolarity correctly populated from LudicCommitmentElement");
}

main()
  .catch((e) => {
    console.error("\n❌ Test failed with error:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
