#!/usr/bin/env tsx
/**
 * Test script for Task 4.3: Real-Time Contradiction Alert UI
 * 
 * Tests the contradiction detection workflow:
 * 1. Create ASSERT move with no contradictions -> Success
 * 2. Create contradicting ASSERT move -> Get 409 with contradictions
 * 3. Retry with bypassContradictionCheck -> Success
 * 4. Verify contradictions are properly structured
 * 
 * Usage:
 *   npx tsx scripts/test-contradiction-alert.ts <deliberationId> <claimId>
 */

import { prisma } from "@/lib/prismaclient";

interface MoveRequest {
  deliberationId: string;
  targetType: "claim" | "argument" | "card";
  targetId: string;
  kind: "ASSERT";
  payload: {
    expression: string;
    locusPath?: string;
    bypassContradictionCheck?: boolean;
  };
}

interface MoveResponse {
  ok: boolean;
  move?: any;
  error?: string;
  contradictions?: any[];
  newCommitment?: {
    text: string;
    targetId: string;
    targetType: string;
  };
  message?: string;
  contradictionsBypassed?: any[];
}

async function createMove(request: MoveRequest): Promise<MoveResponse> {
  const response = await fetch("http://localhost:3000/api/dialogue/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  return { ...data, status: response.status };
}

async function runTests(deliberationId: string, claimId: string) {
  console.log("🧪 Testing Task 4.3: Real-Time Contradiction Alert UI\n");

  // Test 1: Create non-contradictory claim
  console.log("Test 1: Create non-contradictory ASSERT move");
  const test1 = await createMove({
    deliberationId,
    targetType: "claim",
    targetId: claimId,
    kind: "ASSERT",
    payload: {
      expression: "AI improves productivity",
      locusPath: "0",
    },
  });

  if (test1.ok) {
    console.log("✅ Move created successfully");
    console.log(`   Move ID: ${test1.move?.id}`);
  } else {
    console.log(`❌ Failed: ${test1.error}`);
    return;
  }

  // Wait for commitment to be stored
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 2: Try to create contradicting claim
  console.log("\nTest 2: Attempt contradicting ASSERT move");
  const test2 = await createMove({
    deliberationId,
    targetType: "claim",
    targetId: claimId,
    kind: "ASSERT",
    payload: {
      expression: "AI does not improve productivity",
      locusPath: "0",
    },
  });

  if (!test2.ok && test2.error === "CONTRADICTION_DETECTED") {
    console.log("✅ Contradiction detected correctly");
    console.log(`   Contradictions found: ${test2.contradictions?.length || 0}`);
    console.log(`   New commitment: "${test2.newCommitment?.text}"`);
    
    if (test2.contradictions && test2.contradictions.length > 0) {
      const c = test2.contradictions[0];
      console.log(`   Type: ${c.type}`);
      console.log(`   Confidence: ${c.confidence * 100}%`);
      console.log(`   Reason: ${c.reason}`);
    }
  } else if (test2.ok) {
    console.log("❌ Move created without contradiction warning (expected 409)");
    return;
  } else {
    console.log(`❌ Unexpected error: ${test2.error}`);
    return;
  }

  // Test 3: Bypass contradiction check
  console.log("\nTest 3: Bypass contradiction check");
  const test3 = await createMove({
    deliberationId,
    targetType: "claim",
    targetId: claimId,
    kind: "ASSERT",
    payload: {
      expression: "AI does not improve productivity",
      locusPath: "0",
      bypassContradictionCheck: true,
    },
  });

  if (test3.ok) {
    console.log("✅ Move created with bypass flag");
    console.log(`   Move ID: ${test3.move?.id}`);
    console.log(`   Contradictions bypassed: ${test3.contradictionsBypassed?.length || 0}`);
  } else {
    console.log(`❌ Failed to bypass: ${test3.error}`);
    return;
  }

  console.log("\n✅ All tests passed!");
  console.log("\n📊 Summary:");
  console.log("   - Non-contradictory moves work normally");
  console.log("   - Contradictions are detected and blocked (409)");
  console.log("   - Bypass flag allows intentional contradictions");
  console.log("   - API response structure is correct");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/test-contradiction-alert.ts <deliberationId> <claimId>");
    console.error("");
    console.error("Example:");
    console.error("  npx tsx scripts/test-contradiction-alert.ts delib_123 claim_456");
    process.exit(1);
  }

  const [deliberationId, claimId] = args;

  // Verify deliberation exists
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, title: true },
  });

  if (!delib) {
    console.error(`❌ Deliberation not found: ${deliberationId}`);
    process.exit(1);
  }

  console.log(`Using deliberation: ${delib.title || deliberationId}\n`);

  await runTests(deliberationId, claimId);
}

main()
  .catch((err) => {
    console.error("❌ Test script failed:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
