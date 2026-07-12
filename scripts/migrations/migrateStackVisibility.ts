/**
 * migrateStackVisibility.ts
 * 
 * Phase 1.5 of Stacks Improvement Roadmap
 * 
 * Migrates existing is_public boolean to new visibility enum:
 * - is_public=true → public_closed (safe default - anyone can view, only collaborators can add)
 * - is_public=false → private (only owner/collaborators can view/add)
 * 
 * Run with: npx tsx scripts/migrations/migrateStackVisibility.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateVisibility() {
  console.log("Starting visibility migration...\n");

  // Count stacks before migration
  const totalStacks = await prisma.stack.count();
  console.log(`Total stacks: ${totalStacks}`);

  // Check if any stacks still need migration
  // Stacks with visibility=public_closed but is_public=false need updating
  // We'll migrate based on is_public value
  
  // Public stacks → public_closed (safe default - anyone can view)
  const publicResult = await prisma.$executeRaw`
    UPDATE stacks 
    SET visibility = 'public_closed' 
    WHERE is_public = true 
    AND visibility = 'public_closed'
  `;
  
  // Private stacks → private
  const privateResult = await prisma.$executeRaw`
    UPDATE stacks 
    SET visibility = 'private' 
    WHERE is_public = false 
    AND visibility = 'public_closed'
  `;

  console.log(`\nMigration complete:`);
  console.log(`  - Public stacks (→ public_closed): ${publicResult}`);
  console.log(`  - Private stacks (→ private): ${privateResult}`);

  // Verify migration
  const visibilityStats = await prisma.$queryRaw`
    SELECT visibility, COUNT(*) as count 
    FROM stacks 
    GROUP BY visibility
  `;
  
  console.log("\nVisibility distribution:");
  console.log(visibilityStats);
}

async function main() {
  try {
    await migrateVisibility();
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
