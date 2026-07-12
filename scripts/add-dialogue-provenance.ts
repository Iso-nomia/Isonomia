/**
 * Migration Script: Add Dialogue Provenance
 * 
 * Links existing DialogueMoves to the Arguments, ConflictApplications, and Claims they created.
 * Creates DialogueVisualizationNode entries for pure dialogue moves (WHY, CONCEDE, RETRACT, etc.)
 * 
 * Usage:
 *   npx tsx scripts/add-dialogue-provenance.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --deliberation-id  Process only specific deliberation (optional)
 * 
 * CRITICAL ARCHITECTURE NOTE:
 * - This script follows the proven pattern from generate-debate-sheets.ts
 * - Links GROUNDS moves → Arguments via direct argumentId match
 * - Links ATTACK moves → ConflictApplications via timestamp heuristics (±5 seconds)
 * - Creates DialogueVisualizationNode for WHY, CONCEDE, RETRACT, CLOSE, ACCEPT_ARGUMENT moves
 * - Does NOT create AifNode/AifEdge entries (those tables are empty/legacy)
 * 
 * See: DIALOGUE_VISUALIZATION_ROADMAP.md Phase 1.2
 */

import { prisma } from "@/lib/prismaclient";

interface MigrationStats {
  totalMoves: number;
  groundsLinked: number;
  attacksLinked: number;
  claimsLinked: number;
  visualizationNodesCreated: number;
  errors: string[];
}

async function addDialogueProvenance(options: {
  dryRun: boolean;
  deliberationId?: string;
}): Promise<MigrationStats> {
  const { dryRun, deliberationId } = options;

  const stats: MigrationStats = {
    totalMoves: 0,
    groundsLinked: 0,
    attacksLinked: 0,
    claimsLinked: 0,
    visualizationNodesCreated: 0,
    errors: [],
  };

  console.log("🔄 Starting dialogue provenance migration...");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  if (deliberationId) {
    console.log(`Deliberation: ${deliberationId}`);
  }

  // Step 1: Fetch all DialogueMoves
  const allMoves = await prisma.dialogueMove.findMany({
    where: deliberationId ? { deliberationId } : {},
    orderBy: { createdAt: "asc" },
  });

  stats.totalMoves = allMoves.length;
  console.log(`📊 Found ${stats.totalMoves} dialogue moves to process`);

  // Step 2: Link GROUNDS moves to Arguments
  console.log("\n📌 Step 1/4: Linking GROUNDS moves to Arguments...");
  const groundsMoves = allMoves.filter(
    (m) => m.kind === "GROUNDS" && m.argumentId
  );

  for (const move of groundsMoves) {
    try {
      // Verify argument exists
      const argument = await prisma.argument.findUnique({
        where: { id: move.argumentId! },
      });

      if (!argument) {
        stats.errors.push(
          `GROUNDS move ${move.id} references non-existent argument ${move.argumentId}`
        );
        continue;
      }

      if (!dryRun) {
        await prisma.argument.update({
          where: { id: move.argumentId! },
          data: { createdByMoveId: move.id },
        });
      }

      stats.groundsLinked++;
      if (stats.groundsLinked % 100 === 0) {
        console.log(`  ✅ Linked ${stats.groundsLinked} GROUNDS moves...`);
      }
    } catch (error) {
      stats.errors.push(
        `Error linking GROUNDS move ${move.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  console.log(`✅ Linked ${stats.groundsLinked} GROUNDS moves to Arguments`);

  // Step 3: Link ATTACK moves to ConflictApplications
  console.log("\n📌 Step 2/4: Linking ATTACK moves to ConflictApplications...");
  const attackMoves = allMoves.filter((m) => m.kind === "ATTACK");

  for (const move of attackMoves) {
    try {
      // Use timestamp heuristics: find ConflictApplications created within ±5 seconds
      const beforeWindow = new Date(move.createdAt.getTime() - 5000);
      const afterWindow = new Date(move.createdAt.getTime() + 5000);

      const recentConflicts = await prisma.conflictApplication.findMany({
        where: {
          deliberationId: move.deliberationId,
          createdAt: {
            gte: beforeWindow,
            lte: afterWindow,
          },
          createdByMoveId: null, // Only link unlinked conflicts
        },
        orderBy: { createdAt: "asc" },
      });

      // If exactly one match, link it
      if (recentConflicts.length === 1) {
        if (!dryRun) {
          await prisma.conflictApplication.update({
            where: { id: recentConflicts[0].id },
            data: { createdByMoveId: move.id },
          });
        }
        stats.attacksLinked++;
      } else if (recentConflicts.length > 1) {
        // Multiple matches - try to narrow down by actor
        // (Actor who made ATTACK move should be createdById of ConflictApplication)
        const actorConflicts = recentConflicts.filter(
          (c) => c.createdById === move.actorId
        );

        if (actorConflicts.length === 1) {
          if (!dryRun) {
            await prisma.conflictApplication.update({
              where: { id: actorConflicts[0].id },
              data: { createdByMoveId: move.id },
            });
          }
          stats.attacksLinked++;
        } else {
          stats.errors.push(
            `Ambiguous match for ATTACK move ${move.id}: found ${recentConflicts.length} conflicts`
          );
        }
      } else {
        stats.errors.push(
          `No matching ConflictApplication found for ATTACK move ${move.id}`
        );
      }

      if (stats.attacksLinked % 50 === 0 && stats.attacksLinked > 0) {
        console.log(`  ✅ Linked ${stats.attacksLinked} ATTACK moves...`);
      }
    } catch (error) {
      stats.errors.push(
        `Error linking ATTACK move ${move.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  console.log(
    `✅ Linked ${stats.attacksLinked} ATTACK moves to ConflictApplications`
  );

  // Step 4: Create DialogueVisualizationNode for non-argument moves
  console.log(
    "\n📌 Step 3/4: Creating DialogueVisualizationNodes for pure dialogue moves..."
  );
  const visualizationMoveKinds = [
    "WHY",
    "CONCEDE",
    "RETRACT",
    "CLOSE",
    "ACCEPT_ARGUMENT",
  ];
  const visualizationMoves = allMoves.filter((m) =>
    visualizationMoveKinds.includes(m.kind)
  );

  for (const move of visualizationMoves) {
    try {
      // Check if node already exists
      const existing = await prisma.dialogueVisualizationNode.findUnique({
        where: { dialogueMoveId: move.id },
      });

      if (existing) {
        continue; // Skip if already exists
      }

      // Build metadata from move payload
      const metadata = {
        targetType: move.targetType,
        targetId: move.targetId,
        replyToMoveId: move.replyToMoveId,
        payload: move.payload,
      };

      if (!dryRun) {
        await prisma.dialogueVisualizationNode.create({
          data: {
            deliberationId: move.deliberationId,
            dialogueMoveId: move.id,
            nodeKind: move.kind,
            metadata,
          },
        });
      }

      stats.visualizationNodesCreated++;
      if (stats.visualizationNodesCreated % 100 === 0) {
        console.log(
          `  ✅ Created ${stats.visualizationNodesCreated} visualization nodes...`
        );
      }
    } catch (error) {
      stats.errors.push(
        `Error creating DialogueVisualizationNode for move ${move.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  console.log(
    `✅ Created ${stats.visualizationNodesCreated} DialogueVisualizationNodes`
  );

  // Step 5: Link Claims to DialogueMoves (optional - may not have direct link)
  console.log("\n📌 Step 4/4: Linking Claims to introducing DialogueMoves...");
  // Note: This is harder to backfill since Claims don't directly reference DialogueMoves
  // For now, we'll skip this and let it be populated going forward
  console.log(
    "⚠️  Claim linking skipped - will be populated for new claims going forward"
  );

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const deliberationIdArg = args.find((arg) => arg.startsWith("--deliberation-id="));
  const deliberationId = deliberationIdArg?.split("=")[1];

  console.log("════════════════════════════════════════════════════════");
  console.log("  DIALOGUE PROVENANCE MIGRATION");
  console.log("  Phase 1.2: Backfill dialogue tracking");
  console.log("════════════════════════════════════════════════════════\n");

  try {
    const stats = await addDialogueProvenance({ dryRun, deliberationId });

    console.log("\n════════════════════════════════════════════════════════");
    console.log("  MIGRATION SUMMARY");
    console.log("════════════════════════════════════════════════════════");
    console.log(`Total moves processed:         ${stats.totalMoves}`);
    console.log(`GROUNDS → Arguments linked:    ${stats.groundsLinked}`);
    console.log(`ATTACK → Conflicts linked:     ${stats.attacksLinked}`);
    console.log(`Claims linked:                 ${stats.claimsLinked}`);
    console.log(`Visualization nodes created:   ${stats.visualizationNodesCreated}`);
    console.log(`Errors encountered:            ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("\n⚠️  ERRORS:");
      stats.errors.slice(0, 10).forEach((err) => console.log(`  - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
    }

    if (dryRun) {
      console.log("\n🔍 DRY RUN - No changes were made to the database");
      console.log("   Run without --dry-run to apply changes");
    } else {
      console.log("\n✅ Migration completed successfully");
    }

    console.log("════════════════════════════════════════════════════════\n");

    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
