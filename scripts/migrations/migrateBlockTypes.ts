/**
 * Migration: Set existing LibraryPosts to blockType=pdf
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * All existing LibraryPosts are PDFs, so we set their blockType accordingly.
 * 
 * Run with: npx tsx scripts/migrations/migrateBlockTypes.ts
 */

import { prisma } from "@/lib/prismaclient";

async function migrateExistingPosts() {
  console.log("Starting block type migration...\n");

  // Count existing posts without blockType set (or defaulted)
  const totalPosts = await prisma.libraryPost.count();
  console.log(`Found ${totalPosts} total library posts.\n`);

  // Update all existing posts to be explicitly pdf type with completed status
  // The schema default handles this, but we'll be explicit for existing data
  const result = await prisma.libraryPost.updateMany({
    where: {
      // Only update posts that have a file_url (actual PDFs)
      file_url: { not: null },
    },
    data: {
      blockType: "pdf",
      processingStatus: "completed",
    },
  });

  console.log(`Updated ${result.count} existing posts to blockType=pdf`);

  // Verify the migration
  const byType = await prisma.libraryPost.groupBy({
    by: ["blockType"],
    _count: { id: true },
  });

  console.log("\nBlock type distribution:");
  byType.forEach((t) => {
    console.log(`  ${t.blockType}: ${t._count.id}`);
  });

  const byStatus = await prisma.libraryPost.groupBy({
    by: ["processingStatus"],
    _count: { id: true },
  });

  console.log("\nProcessing status distribution:");
  byStatus.forEach((s) => {
    console.log(`  ${s.processingStatus}: ${s._count.id}`);
  });

  console.log("\n✅ Migration complete!");
}

// Main execution
migrateExistingPosts()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
