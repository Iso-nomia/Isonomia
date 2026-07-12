/**
 * Backfill StackItems from Stack.order and LibraryPost.stack_id
 * 
 * Phase 1.1 of Stacks Improvement Roadmap
 * 
 * This script migrates the existing implicit Stack ↔ LibraryPost relationships
 * to the new StackItem join table, enabling multi-stack connections.
 * 
 * Run with: npx tsx scripts/migrations/backfillStackItems.ts
 */

import { prisma } from "@/lib/prismaclient";

interface MigrationStats {
  stacksProcessed: number;
  itemsCreated: number;
  orphansFound: number;
  duplicatesSkipped: number;
  errors: string[];
}

async function backfillStackItems(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    stacksProcessed: 0,
    itemsCreated: 0,
    orphansFound: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  console.log("Starting StackItem backfill migration...\n");

  // Process all stacks with their order arrays
  const stacks = await prisma.stack.findMany({
    select: {
      id: true,
      order: true,
      owner_id: true,
      posts: { select: { id: true } },
    },
  });

  console.log(`Found ${stacks.length} stacks to process.\n`);

  for (const stack of stacks) {
    try {
      const order = stack.order ?? [];
      const postsInOrder = new Set(order);

      // Create StackItems from order array (preserves position)
      for (let i = 0; i < order.length; i++) {
        const blockId = order[i];

        // Check if the block actually exists
        const blockExists = stack.posts.some((p) => p.id === blockId);
        if (!blockExists) {
          // Block referenced in order but doesn't exist - skip
          stats.errors.push(
            `Stack ${stack.id}: order entry ${blockId} references non-existent block`
          );
          continue;
        }

        try {
          await prisma.stackItem.upsert({
            where: {
              stackId_blockId: { stackId: stack.id, blockId },
            },
            create: {
              stackId: stack.id,
              blockId,
              kind: "block",
              position: (i + 1) * 1000, // Leave gaps: 1000, 2000, 3000...
              addedById: stack.owner_id,
            },
            update: {}, // Don't overwrite if exists
          });

          stats.itemsCreated++;
        } catch (e: any) {
          if (e.code === "P2002") {
            // Unique constraint violation - already exists
            stats.duplicatesSkipped++;
          } else {
            throw e;
          }
        }
      }

      // Handle orphans: posts with stack_id pointing to this stack but not in order array
      for (const post of stack.posts) {
        if (!postsInOrder.has(post.id)) {
          stats.orphansFound++;

          const maxPosition = await prisma.stackItem.aggregate({
            where: { stackId: stack.id },
            _max: { position: true },
          });

          try {
            await prisma.stackItem.upsert({
              where: {
                stackId_blockId: { stackId: stack.id, blockId: post.id },
              },
              create: {
                stackId: stack.id,
                blockId: post.id,
                kind: "block",
                position: (maxPosition._max.position ?? 0) + 1000,
                addedById: stack.owner_id,
              },
              update: {},
            });

            stats.itemsCreated++;
          } catch (e: any) {
            if (e.code === "P2002") {
              stats.duplicatesSkipped++;
            } else {
              throw e;
            }
          }
        }
      }

      stats.stacksProcessed++;

      // Progress logging every 50 stacks
      if (stats.stacksProcessed % 50 === 0) {
        console.log(`Processed ${stats.stacksProcessed}/${stacks.length} stacks...`);
      }
    } catch (error) {
      stats.errors.push(`Stack ${stack.id}: ${error}`);
    }
  }

  return stats;
}

async function verifyMigration(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  console.log("\nVerifying migration...\n");

  // Check 1: Every Stack.order entry has a StackItem
  const stacks = await prisma.stack.findMany({
    select: { id: true, order: true, name: true },
  });

  for (const stack of stacks) {
    if (!stack.order || stack.order.length === 0) continue;

    const items = await prisma.stackItem.findMany({
      where: { stackId: stack.id, kind: "block" },
      select: { blockId: true },
    });
    const itemBlockIds = new Set(items.map((i) => i.blockId));

    for (const orderId of stack.order) {
      if (!itemBlockIds.has(orderId)) {
        // Check if block actually exists
        const blockExists = await prisma.libraryPost.findUnique({
          where: { id: orderId },
          select: { id: true },
        });
        if (blockExists) {
          issues.push(
            `Stack "${stack.name}" (${stack.id}): order entry ${orderId} missing StackItem`
          );
        }
      }
    }
  }

  // Check 2: StackItem order roughly matches Stack.order sequence
  let orderMismatches = 0;
  for (const stack of stacks) {
    if (!stack.order || stack.order.length === 0) continue;

    const items = await prisma.stackItem.findMany({
      where: { stackId: stack.id, kind: "block" },
      orderBy: { position: "asc" },
      select: { blockId: true },
    });
    const itemOrder = items.map((i) => i.blockId).filter((id) => stack.order.includes(id!));

    // Filter stack.order to only include blocks that have StackItems
    const filteredOrder = stack.order.filter((id) =>
      items.some((i) => i.blockId === id)
    );

    if (JSON.stringify(itemOrder) !== JSON.stringify(filteredOrder)) {
      orderMismatches++;
    }
  }

  if (orderMismatches > 0) {
    issues.push(`${orderMismatches} stacks have order mismatches (may be due to orphaned blocks)`);
  }

  // Check 3: Every LibraryPost.stack_id has corresponding StackItem
  const postsWithStackId = await prisma.libraryPost.findMany({
    where: { stack_id: { not: null } },
    select: { id: true, stack_id: true, title: true },
  });

  let missingStackItems = 0;
  for (const post of postsWithStackId) {
    const item = await prisma.stackItem.findUnique({
      where: {
        stackId_blockId: { stackId: post.stack_id!, blockId: post.id },
      },
    });
    if (!item) {
      missingStackItems++;
    }
  }

  if (missingStackItems > 0) {
    issues.push(
      `${missingStackItems} posts have stack_id but no corresponding StackItem`
    );
  }

  // Summary stats
  const totalStackItems = await prisma.stackItem.count();
  const totalStacks = await prisma.stack.count();
  const totalPosts = await prisma.libraryPost.count();

  console.log("Migration Summary:");
  console.log(`  Total stacks: ${totalStacks}`);
  console.log(`  Total library posts: ${totalPosts}`);
  console.log(`  Total StackItems created: ${totalStackItems}`);
  console.log(`  Posts with stack_id: ${postsWithStackId.length}`);

  return { valid: issues.length === 0, issues };
}

// Main execution
async function main() {
  try {
    // Run backfill
    const stats = await backfillStackItems();

    console.log("\n========================================");
    console.log("Backfill Complete!");
    console.log("========================================");
    console.log(`  Stacks processed: ${stats.stacksProcessed}`);
    console.log(`  StackItems created: ${stats.itemsCreated}`);
    console.log(`  Orphaned posts found: ${stats.orphansFound}`);
    console.log(`  Duplicates skipped: ${stats.duplicatesSkipped}`);
    console.log(`  Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("\nErrors:");
      stats.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more`);
      }
    }

    // Verify migration
    const verification = await verifyMigration();

    if (verification.issues.length > 0) {
      console.log("\nVerification Issues:");
      verification.issues.forEach((i) => console.log(`  ⚠️  ${i}`));
    } else {
      console.log("\n✅ Verification passed - all data migrated correctly!");
    }

    process.exit(stats.errors.length > 0 || !verification.valid ? 1 : 0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
