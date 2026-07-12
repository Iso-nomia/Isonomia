/**
 * Quick test script for the recompute-support endpoint
 * Finds a composed argument and tests manual recomputation
 */

import { prisma } from "@/lib/prismaclient";

async function testRecomputeEndpoint() {
  console.log("Finding a composed argument to test...\n");

  // Find a composed argument
  const support = await prisma.argumentSupport.findFirst({
    where: { composed: true },
  });

  if (!support) {
    console.log("No composed arguments found. Run backfill-composition-tracking.ts first.");
    return;
  }

  console.log("Found argument:");
  console.log(`  ID: ${support.argumentId}`);
  console.log(`  Current strength: ${support.strength}`);
  console.log(`  Rationale: ${support.rationale}\n`);

  console.log("To test the endpoint, run:");
  console.log(`  curl -X POST http://localhost:3000/api/arguments/${support.argumentId}/recompute-support\n`);

  console.log("Or start your dev server and visit:");
  console.log(`  POST http://localhost:3000/api/arguments/${support.argumentId}/recompute-support\n`);
}

testRecomputeEndpoint()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
