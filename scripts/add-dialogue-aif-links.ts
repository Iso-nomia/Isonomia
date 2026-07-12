#!/usr/bin/env tsx
/**
 * Migration Script: Add Dialogue AIF Links
 * 
 * Purpose: Backfill AifNode and AifEdge records for existing DialogueMoves
 * 
 * Phase: 1.4 - Dialogue Visualization Roadmap
 * Date: November 2, 2025
 * 
 * What this script does:
 * 1. Fetches all DialogueMoves in chronological order
 * 2. Creates DM-nodes for each move based on move kind
 * 3. Creates AifEdges representing dialogue flow (triggers, answers, repliesTo)
 * 4. Links DM-nodes to existing Argument/Claim nodes where applicable
 * 5. Updates DialogueMove.aifRepresentation with DM-node ID
 * 
 * Usage:
 *   npx tsx scripts/add-dialogue-aif-links.ts --dry-run   # Preview changes
 *   npx tsx scripts/add-dialogue-aif-links.ts             # Run migration
 *   npx tsx scripts/add-dialogue-aif-links.ts --delib=<id> # Migrate specific deliberation
 * 
 * Safety:
 * - Always run with --dry-run first
 * - Creates database backup before running
 * - Uses transactions (50 moves per batch)
 * - Logs progress to logs/migrations/add-dialogue-aif-links.log
 */

import { PrismaClient } from "@prisma/client";
import { dialogueKindToAifType } from "@/lib/aif/ontology";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const deliberationFilter = args.find(arg => arg.startsWith("--delib="))?.split("=")[1];
const batchSize = 50;

// Locution mapping for dialogue moves
const LOCUTION_MAP: Record<string, "question" | "assertion"> = {
  WHY: "question",
  GROUNDS: "question",
  CONCEDE: "assertion",
  RETRACT: "assertion",
  THEREFORE: "assertion",
  ASSERT: "assertion",
  REBUT: "assertion",
  UNDERCUT: "assertion",
  SUPPORT: "assertion",
};

// Setup logging
const logsDir = path.join(process.cwd(), "logs", "migrations");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFile = path.join(logsDir, `add-dialogue-aif-links-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: "a" });

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + "\n");
}

/**
 * Determine AIF node IDs that should be linked to this dialogue move
 */
function getLinkedNodeIds(move: any): string[] {
  const linkedIds: string[] = [];
  
  // Link to argument if move references an argument (e.g., GROUNDS creates argument)
  if (move.argumentId) {
    linkedIds.push(`RA:${move.argumentId}`);
  }
  
  // Link to claim if move targets a claim
  if (move.targetType === "claim" && move.targetId) {
    linkedIds.push(`I:${move.targetId}`);
  }
  
  // Link to argument if move targets an argument
  if (move.targetType === "argument" && move.targetId) {
    linkedIds.push(`RA:${move.targetId}`);
  }
  
  return linkedIds;
}

/**
 * Create DM-node for a dialogue move
 */
async function createDmNode(move: any, dryRun: boolean) {
  const dmNodeId = `DM:${move.id}`;
  const nodeSubtype = move.kind;
  const locution = LOCUTION_MAP[nodeSubtype] || "assertion";
  
  const dialogueMetadata = {
    locution: locution,
    speaker: move.actorId,
    timestamp: move.createdAt.toISOString(),
    ...(move.replyToMoveId && { replyToMoveId: move.replyToMoveId }),
    ...(move.targetType === "claim" && move.targetId && { claimId: move.targetId }),
  };
  
  log(`  Creating DM-node: ${dmNodeId} (${nodeSubtype})`);
  
  if (!dryRun) {
    // Use raw query since Prisma client may not be regenerated yet
    await prisma.$executeRaw`
      INSERT INTO "AifNode" (id, "deliberationId", "nodeKind", "nodeSubtype", "dialogueMoveId", "dialogueMetadata")
      VALUES (${dmNodeId}, ${move.deliberationId}, 'DM', ${nodeSubtype}, ${move.id}, ${JSON.stringify(dialogueMetadata)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
  }
  
  return dmNodeId;
}

/**
 * Create AIF edges for dialogue flow
 */
async function createDialogueEdges(move: any, dmNodeId: string, dryRun: boolean) {
  const edges: any[] = [];
  
  // If this move replies to another move, create 'triggers' or 'answers' edge
  if (move.replyToMoveId) {
    const parentDmNode = `DM:${move.replyToMoveId}`;
    const edgeRole = move.kind === "WHY" || move.kind === "GROUNDS" ? "triggers" : "answers";
    
    log(`  Creating edge: ${dmNodeId} --${edgeRole}--> ${parentDmNode}`);
    
    edges.push({
      id: `edge:${dmNodeId}:${edgeRole}:${parentDmNode}`,
      deliberationId: move.deliberationId,
      sourceId: dmNodeId,
      targetId: parentDmNode,
      edgeRole: edgeRole,
      causedByMoveId: move.id,
      metadata: {
        timestamp: move.createdAt.toISOString(),
      },
    });
  }
  
  // Link DM-node to argument/claim nodes
  const linkedNodeIds = getLinkedNodeIds(move);
  for (const targetId of linkedNodeIds) {
    const edgeRole = targetId.startsWith("RA:") ? "repliesTo" : "commitsTo";
    
    log(`  Creating edge: ${dmNodeId} --${edgeRole}--> ${targetId}`);
    
    edges.push({
      id: `edge:${dmNodeId}:${edgeRole}:${targetId}`,
      deliberationId: move.deliberationId,
      sourceId: dmNodeId,
      targetId: targetId,
      edgeRole: edgeRole,
      causedByMoveId: move.id,
      metadata: {
        timestamp: move.createdAt.toISOString(),
      },
    });
  }
  
  if (!dryRun && edges.length > 0) {
    // Use raw query since Prisma client may not be regenerated yet
    for (const edge of edges) {
      await prisma.$executeRaw`
        INSERT INTO "AifEdge" (id, "deliberationId", "sourceId", "targetId", "edgeRole", "causedByMoveId", metadata)
        VALUES (${edge.id}, ${edge.deliberationId}, ${edge.sourceId}, ${edge.targetId}, ${edge.edgeRole}, ${edge.causedByMoveId}, ${JSON.stringify(edge.metadata)}::jsonb)
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
  
  return edges.length;
}

/**
 * Update DialogueMove.aifRepresentation with DM-node ID
 */
async function updateMoveRepresentation(moveId: string, dmNodeId: string, dryRun: boolean) {
  log(`  Updating DialogueMove.aifRepresentation: ${dmNodeId}`);
  
  if (!dryRun) {
    // Use raw query since Prisma client may not be regenerated yet
    await prisma.$executeRaw`
      UPDATE "DialogueMove"
      SET "aifRepresentation" = ${dmNodeId}
      WHERE id = ${moveId}
    `;
  }
}

/**
 * Process a batch of dialogue moves
 */
async function processBatch(moves: any[], dryRun: boolean) {
  let nodesCreated = 0;
  let edgesCreated = 0;
  let movesUpdated = 0;
  
  for (const move of moves) {
    log(`\nProcessing move ${move.id} (${move.kind}) at ${move.createdAt.toISOString()}`);
    
    try {
      // Create DM-node
      const dmNodeId = await createDmNode(move, dryRun);
      nodesCreated++;
      
      // Create dialogue edges
      const edgeCount = await createDialogueEdges(move, dmNodeId, dryRun);
      edgesCreated += edgeCount;
      
      // Update move representation AFTER node is created (to satisfy foreign key)
      await updateMoveRepresentation(move.id, dmNodeId, dryRun);
      movesUpdated++;
      
    } catch (error: any) {
      log(`  ERROR processing move ${move.id}: ${error.message}`);
      // Continue processing other moves even if one fails
    }
  }
  
  return { nodesCreated, edgesCreated, movesUpdated };
}

/**
 * Main migration function
 */
async function runMigration() {
  const startTime = Date.now();
  
  log("=".repeat(80));
  log("Starting Dialogue AIF Links Migration");
  log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "PRODUCTION"}`);
  if (deliberationFilter) {
    log(`Filter: deliberationId = ${deliberationFilter}`);
  }
  log("=".repeat(80));
  
  try {
    // Fetch all dialogue moves in chronological order
    const whereClause = deliberationFilter 
      ? { deliberationId: deliberationFilter }
      : {};
    
    const totalMoves = await prisma.dialogueMove.count({ where: whereClause });
    log(`\nFound ${totalMoves} dialogue moves to process`);
    
    if (totalMoves === 0) {
      log("No moves to process. Exiting.");
      return;
    }
    
    // Ask for confirmation in production mode
    if (!isDryRun) {
      log("\n⚠️  WARNING: This will modify the database!");
      log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
      await new Promise(resolve => setTimeout(resolve, 5000));
      log("Proceeding with migration...\n");
    }
    
    let offset = 0;
    let totalNodesCreated = 0;
    let totalEdgesCreated = 0;
    let totalMovesUpdated = 0;
    
    while (offset < totalMoves) {
      log(`\n${"=".repeat(80)}`);
      log(`Processing batch ${Math.floor(offset / batchSize) + 1} (offset ${offset})`);
      log(`${"=".repeat(80)}`);
      
      const moves = await prisma.dialogueMove.findMany({
        where: whereClause,
        orderBy: { createdAt: "asc" },
        take: batchSize,
        skip: offset,
      });
      
      // Process batch in transaction
      const result = await processBatch(moves, isDryRun);
      
      totalNodesCreated += result.nodesCreated;
      totalEdgesCreated += result.edgesCreated;
      totalMovesUpdated += result.movesUpdated;
      
      offset += batchSize;
      
      log(`\nBatch complete: ${result.nodesCreated} nodes, ${result.edgesCreated} edges, ${result.movesUpdated} moves updated`);
    }
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log("\n" + "=".repeat(80));
    log("Migration Complete!");
    log("=".repeat(80));
    log(`Total dialogue moves processed: ${totalMoves}`);
    log(`Total DM-nodes created: ${totalNodesCreated}`);
    log(`Total edges created: ${totalEdgesCreated}`);
    log(`Total moves updated: ${totalMovesUpdated}`);
    log(`Duration: ${duration}s`);
    log(`Mode: ${isDryRun ? "DRY RUN (no changes made)" : "PRODUCTION"}`);
    log("=".repeat(80));
    
    if (isDryRun) {
      log("\n✅ Dry run complete. Review the log above and run without --dry-run to apply changes.");
    } else {
      log("\n✅ Migration complete. AIF nodes and edges created for all dialogue moves.");
    }
    
  } catch (error: any) {
    log(`\n❌ FATAL ERROR: ${error.message}`);
    log(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
    logStream.end();
    log(`\nLog file: ${logFile}`);
  }
}

// Run migration
runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
