#!/usr/bin/env tsx
/**
 * Migration Script: DialogueAction → DialogueMove
 * 
 * Purpose: Merge DialogueAction functionality into DialogueMove to eliminate
 * architectural duplication. This script:
 * 
 * 1. Finds all DialogueAction records
 * 2. For each action, tries to find matching DialogueMove
 * 3. If match found, copies completion tracking to DialogueMove
 * 4. Migrates ResponseVote records to point to DialogueMove
 * 5. Validates migration success
 * 
 * Run before dropping DialogueAction table!
 * 
 * Usage: tsx scripts/migrate-dialogue-action-to-move.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MigrationStats {
  totalActions: number;
  matchedMoves: number;
  unmatchedActions: number;
  completionsMigrated: number;
  votesMigrated: number;
  errors: string[];
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  
  console.log("🔄 Starting DialogueAction → DialogueMove migration");
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE MIGRATION"}`);
  console.log("─".repeat(60));

  const stats: MigrationStats = {
    totalActions: 0,
    matchedMoves: 0,
    unmatchedActions: 0,
    completionsMigrated: 0,
    votesMigrated: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch all DialogueAction records
    console.log("\n📊 Step 1: Fetching DialogueAction records...");
    const actions = await prisma.dialogueAction.findMany({
      include: { votes: true },
    });
    stats.totalActions = actions.length;
    console.log(`   Found ${stats.totalActions} DialogueAction records`);

    if (stats.totalActions === 0) {
      console.log("✅ No DialogueAction records to migrate");
      return stats;
    }

    // Step 2: Match DialogueActions to DialogueMoves
    console.log("\n🔍 Step 2: Matching DialogueActions to DialogueMoves...");
    
    for (const action of actions) {
      try {
        // Try to find matching DialogueMove by:
        // - deliberationId
        // - targetId
        // - kind matches actionType (GROUNDS → GROUNDS, etc.)
        // - createdAt within 5 seconds (same transaction)
        
        const timeWindow = 5000; // 5 seconds
        const createdAtMin = new Date(action.createdAt.getTime() - timeWindow);
        const createdAtMax = new Date(action.createdAt.getTime() + timeWindow);
        
        const matchingMove = await prisma.dialogueMove.findFirst({
          where: {
            deliberationId: action.deliberationId,
            targetId: action.targetId,
            kind: action.actionType, // GROUNDS, WARRANT, etc.
            createdAt: {
              gte: createdAtMin,
              lte: createdAtMax,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        if (matchingMove) {
          stats.matchedMoves++;
          
          console.log(`   ✓ Matched Action ${action.id.slice(0, 8)} → Move ${matchingMove.id.slice(0, 8)}`);
          
          // Step 3: Migrate completion tracking
          if (action.completed || action.completedAt || action.completedBy) {
            if (!isDryRun) {
              await prisma.dialogueMove.update({
                where: { id: matchingMove.id },
                data: {
                  completed: action.completed,
                  completedAt: action.completedAt,
                  completedBy: action.completedBy,
                },
              });
            }
            stats.completionsMigrated++;
            console.log(`     → Migrated completion tracking (completed=${action.completed})`);
          }
          
          // Step 4: Migrate ResponseVote records
          if (action.votes.length > 0) {
            console.log(`     → Migrating ${action.votes.length} votes...`);
            
            for (const vote of action.votes) {
              if (!isDryRun) {
                // Check if vote already exists for this move + voter
                const existing = await prisma.responseVote.findUnique({
                  where: {
                    dialogueMoveId_voterId: {
                      dialogueMoveId: matchingMove.id,
                      voterId: vote.voterId,
                    },
                  },
                });
                
                if (!existing) {
                  await prisma.responseVote.create({
                    data: {
                      dialogueMoveId: matchingMove.id,
                      voterId: vote.voterId,
                      voteType: vote.voteType,
                      createdAt: vote.createdAt,
                    },
                  });
                  stats.votesMigrated++;
                } else {
                  console.log(`       ⚠ Vote already exists for voter ${vote.voterId.slice(0, 8)}, skipping`);
                }
              } else {
                stats.votesMigrated++;
              }
            }
            
            console.log(`     → Migrated ${action.votes.length} votes`);
          }
          
        } else {
          stats.unmatchedActions++;
          console.log(`   ⚠ No matching DialogueMove for Action ${action.id.slice(0, 8)}`);
          console.log(`     Type: ${action.actionType}, Target: ${action.targetId.slice(0, 8)}, Created: ${action.createdAt.toISOString()}`);
          
          // Log as potential data loss
          stats.errors.push(
            `Unmatched DialogueAction: ${action.id} (${action.actionType} on ${action.targetId})`
          );
        }
        
      } catch (err) {
        const error = `Failed to process action ${action.id}: ${err}`;
        console.error(`   ❌ ${error}`);
        stats.errors.push(error);
      }
    }

    // Step 5: Validation
    console.log("\n✅ Step 3: Validation");
    console.log(`   Total DialogueActions: ${stats.totalActions}`);
    console.log(`   Matched to DialogueMoves: ${stats.matchedMoves}`);
    console.log(`   Unmatched (potential data loss): ${stats.unmatchedActions}`);
    console.log(`   Completions migrated: ${stats.completionsMigrated}`);
    console.log(`   Votes migrated: ${stats.votesMigrated}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    // Step 6: Recommendations
    console.log("\n📋 Next Steps:");
    
    if (isDryRun) {
      console.log("   1. Review migration results above");
      console.log("   2. If acceptable, run without --dry-run flag");
      console.log("   3. After live migration, verify data integrity");
      console.log("   4. Then run: tsx scripts/drop-dialogue-action-table.ts");
    } else {
      console.log("   ✅ Migration complete!");
      
      if (stats.unmatchedActions > 0) {
        console.log(`   ⚠️  WARNING: ${stats.unmatchedActions} DialogueAction records could not be matched`);
        console.log("   → Review unmatched actions before dropping DialogueAction table");
        console.log("   → Consider manual migration or investigation");
      } else {
        console.log("   ✅ All DialogueAction records successfully matched");
        console.log("   → Safe to drop DialogueAction table");
      }
      
      console.log("\n   To drop DialogueAction table:");
      console.log("   1. Remove DialogueAction model from schema.prisma");
      console.log("   2. Run: npx prisma db push");
    }
    
    return stats;
    
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main()
  .then((stats) => {
    console.log("\n" + "─".repeat(60));
    console.log("🎉 Migration script completed");
    process.exit(stats.errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
