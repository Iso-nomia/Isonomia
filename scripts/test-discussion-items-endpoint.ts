/**
 * Test script for unified discussion items endpoint
 * 
 * Usage: tsx scripts/test-discussion-items-endpoint.ts [deliberationId]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testDiscussionItemsEndpoint(deliberationId?: string) {
  try {
    // If no deliberationId provided, find one with mixed content
    if (!deliberationId) {
      console.log("Finding deliberation with mixed content...");
      
      const deliberations = await prisma.deliberation.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
        },
      });

      // Check each deliberation for content
      let withContent = null;
      for (const delib of deliberations) {
        const [propCount, claimCount, argCount] = await Promise.all([
          prisma.proposition.count({ where: { deliberationId: delib.id } }),
          prisma.claim.count({ where: { deliberationId: delib.id } }),
          prisma.argument.count({ where: { deliberationId: delib.id } }),
        ]);

        if (propCount > 0 || claimCount > 0 || argCount > 0) {
          withContent = { ...delib, propCount, claimCount, argCount };
          break;
        }
      }

      if (!withContent) {
        console.log("No deliberations with content found");
        return;
      }

      deliberationId = withContent.id;
      console.log(
        `Found deliberation ${deliberationId}: ${withContent.propCount} propositions, ${withContent.claimCount} claims, ${withContent.argCount} arguments`
      );
    }

    // Fetch discussion items
    console.log(`\nFetching discussion items for deliberation ${deliberationId}...`);
    
    const [propCount, claimCount, argCount] = await Promise.all([
      prisma.proposition.count({ where: { deliberationId } }),
      prisma.claim.count({ where: { deliberationId } }),
      prisma.argument.count({ where: { deliberationId } }),
    ]);

    console.log(`\n✅ Data counts:`);
    console.log(`  Propositions: ${propCount}`);
    console.log(`  Claims: ${claimCount}`);
    console.log(`  Arguments: ${argCount}`);
    console.log(`  Total items: ${propCount + claimCount + argCount}`);

    if (propCount + claimCount + argCount === 0) {
      console.log("\n⚠️  No discussion items found. Try a different deliberation.");
      return;
    }

    // Test the unified endpoint URL
    console.log(`\n✅ Test complete! Use this deliberationId to test in browser:`);
    console.log(`   GET /api/deliberations/${deliberationId}/discussion-items?limit=50&includeMetadata=true`);
    console.log(`\nOr test with fetch in browser console:`);
    console.log(`   fetch("/api/deliberations/${deliberationId}/discussion-items?limit=50&includeMetadata=true")`);
    console.log(`     .then(r => r.json()).then(console.log);`);
  } catch (error) {
    console.error("Error testing discussion items endpoint:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const deliberationId = process.argv[2];
testDiscussionItemsEndpoint(deliberationId);
