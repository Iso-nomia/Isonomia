/**
 * Integration test script for scoped designs
 * Run with: npx tsx scripts/test-scoped-designs.ts
 * 
 * This script tests the full compilation pipeline with different scoping strategies
 * and provides detailed output for manual verification.
 */

import { prisma } from "@/lib/prismaclient";
import { compileFromMoves } from "@/packages/ludics-engine/compileFromMoves";
import "dotenv/config";

async function main() {
  console.log("🧪 Testing Scoped Designs Architecture\n");
  console.log("=" .repeat(60));

  // Find a real deliberation with both arguments AND moves
  const deliberation = await prisma.deliberation.findFirst({
    where: {
      arguments: {
        some: {},
      },
    },
    include: {
      arguments: {
        take: 5,
        select: { id: true, text: true },
      },
    },
  });

  if (!deliberation) {
    console.log("❌ No deliberation found with arguments. Please create test data first.");
    return;
  }

  // Fetch moves separately (no back-relation on Deliberation)
  const moves = await prisma.dialogueMove.findMany({
    where: { deliberationId: deliberation.id },
    take: 10,
    select: { id: true, kind: true, targetType: true, targetId: true },
  });

  console.log(`\n📋 Test Deliberation: ${deliberation.id}`);
  console.log(`   Title: ${deliberation.title || "(untitled)"}`);
  console.log(`   Arguments: ${deliberation.arguments.length}`);
  console.log(`   Moves: ${moves.length}`);
  
  if (moves.length === 0) {
    console.log("\n⚠️  This deliberation has no dialogue moves.");
    console.log("   Creating minimal test data for demonstration...\n");
    
    // Create a test move if none exist
    if (deliberation.arguments.length > 0) {
      await prisma.dialogueMove.create({
        data: {
          deliberationId: deliberation.id,
          targetType: "argument",
          targetId: deliberation.arguments[0].id,
          kind: "ASSERT",
          actorId: "test-actor",
          signature: `test-${Date.now()}`,
          payload: { text: "Test assertion" },
        },
      });
      console.log("   ✅ Created test ASSERT move");
      
      await prisma.dialogueMove.create({
        data: {
          deliberationId: deliberation.id,
          targetType: "argument",
          targetId: deliberation.arguments[0].id,
          kind: "WHY",
          actorId: "test-actor-2",
          signature: `test-why-${Date.now()}`,
          payload: { text: "Why?" },
        },
      });
      console.log("   ✅ Created test WHY move\n");
    }
  }
  
  if (deliberation.arguments.length > 0) {
    console.log("\n   Sample Arguments:");
    deliberation.arguments.slice(0, 3).forEach((arg, i) => {
      console.log(`   ${i + 1}. ${arg.text?.slice(0, 60)}...`);
    });
  }

  console.log("\n" + "=".repeat(60));

  // Test 1: Legacy mode (backward compatibility)
  console.log("\n🧪 Test 1: Legacy Mode (Backward Compatibility)");
  console.log("-".repeat(60));
  
  const legacyResult = await compileFromMoves(deliberation.id, {
    scopingStrategy: "legacy",
    forceRecompile: true,
  });

  console.log(`✅ Compiled: ${legacyResult.designs.length} designs`);
  
  const legacyDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId: deliberation.id, scope: null },
    include: { acts: true },
  });

  console.log(`   - scope=null: ${legacyDesigns.length} designs`);
  console.log(`   - Proponent acts: ${legacyDesigns.find(d => d.participantId === "Proponent")?.acts.length || 0}`);
  console.log(`   - Opponent acts: ${legacyDesigns.find(d => d.participantId === "Opponent")?.acts.length || 0}`);

  if (legacyDesigns.length !== 2) {
    console.log("   ⚠️  WARNING: Expected 2 designs in legacy mode!");
  }

  // Test 2: topic-based scoping
  console.log("\n🧪 Test 2: topic-Based Scoping");
  console.log("-".repeat(60));

  const topicResult = await compileFromMoves(deliberation.id, {
    scopingStrategy: "topic",
    forceRecompile: true,
  });

  console.log(`✅ Compiled: ${topicResult.designs.length} designs`);

  const topicDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId: deliberation.id, scopeType: "topic" },
    include: { acts: true },
  });

  // Group by scope
  const scopeMap = new Map<string, typeof topicDesigns>();
  for (const design of topicDesigns) {
    const scopeKey = design.scope || "null";
    if (!scopeMap.has(scopeKey)) {
      scopeMap.set(scopeKey, []);
    }
    scopeMap.get(scopeKey)!.push(design);
  }

  console.log(`   - Unique scopes: ${scopeMap.size}`);
  console.log(`   - Expected: ~${deliberation.arguments.length} (one per argument)`);

  let scopeNum = 1;
  for (const [scopeKey, designs] of scopeMap.entries()) {
    const metadata = designs[0].scopeMetadata as any;
    const label = metadata?.label || scopeKey;
    const moveCount = metadata?.moveCount || 0;
    
    console.log(`\n   Scope ${scopeNum}: ${label}`);
    console.log(`      Key: ${scopeKey}`);
    console.log(`      Designs: ${designs.length} (${designs.map(d => d.participantId).join(", ")})`);
    console.log(`      Moves: ${moveCount}`);
    console.log(`      Acts: P=${designs.find(d => d.participantId === "Proponent")?.acts.length || 0}, O=${designs.find(d => d.participantId === "Opponent")?.acts.length || 0}`);
    
    if (metadata?.actors) {
      console.log(`      Actors: ${metadata.actors.all.length} (P: ${metadata.actors.proponent.length}, O: ${metadata.actors.opponent.length})`);
    }
    
    scopeNum++;
  }

  if (scopeMap.size === 0) {
    console.log("   ⚠️  WARNING: No scopes created! Check if moves have targetType='argument'");
  }

  // Test 3: Argument-thread scoping
  console.log("\n🧪 Test 3: Argument-Thread Scoping");
  console.log("-".repeat(60));

  const argumentResult = await compileFromMoves(deliberation.id, {
    scopingStrategy: "argument",
    forceRecompile: true,
  });

  console.log(`✅ Compiled: ${argumentResult.designs.length} designs`);

  const argumentDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId: deliberation.id, scopeType: "argument" },
  });

  const argScopeMap = new Map<string, typeof argumentDesigns>();
  for (const design of argumentDesigns) {
    const scopeKey = design.scope || "null";
    if (!argScopeMap.has(scopeKey)) {
      argScopeMap.set(scopeKey, []);
    }
    argScopeMap.get(scopeKey)!.push(design);
  }

  console.log(`   - Unique scopes: ${argScopeMap.size}`);
  console.log(`   - Total designs: ${argumentDesigns.length}`);

  // Test 4: API endpoint
  console.log("\n🧪 Test 4: API Endpoint Response");
  console.log("-".repeat(60));

  const apiDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId: deliberation.id },
    orderBy: [{ scope: "asc" }, { participantId: "asc" }],
  });

  const apiGrouped: Record<string, typeof apiDesigns> = {};
  for (const design of apiDesigns) {
    const scopeKey = design.scope ?? "legacy";
    if (!apiGrouped[scopeKey]) {
      apiGrouped[scopeKey] = [];
    }
    apiGrouped[scopeKey].push(design);
  }

  console.log(`✅ GET /api/ludics/designs simulation:`);
  console.log(`   - Total designs: ${apiDesigns.length}`);
  console.log(`   - Grouped scopes: ${Object.keys(apiGrouped).length}`);
  console.log(`   - Scopes: ${Object.keys(apiGrouped).join(", ")}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));
  
  const allDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId: deliberation.id },
  });

  const byStrategy = new Map<string, number>();
  for (const design of allDesigns) {
    const strategy = design.scopeType || "legacy";
    byStrategy.set(strategy, (byStrategy.get(strategy) || 0) + 1);
  }

  console.log("\nDesigns by strategy:");
  for (const [strategy, count] of byStrategy.entries()) {
    console.log(`   - ${strategy}: ${count} designs`);
  }

  console.log("\n✅ All tests completed!");
  console.log("\nNext steps:");
  console.log("   1. Verify designs in UI (LudicsPanel → Forest view)");
  console.log("   2. Test recompilation button");
  console.log("   3. Check scope metadata is displayed correctly");
  console.log("   4. Verify backward compatibility with existing deliberations");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
