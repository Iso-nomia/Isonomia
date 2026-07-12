#!/usr/bin/env tsx
/**
 * Verification Script: Check Dialogue Provenance Migration Results
 * 
 * Queries the database to verify:
 * 1. Arguments with createdByMoveId populated
 * 2. ConflictApplications with createdByMoveId populated  
 * 3. DialogueVisualizationNodes created
 */

import { prisma } from "@/lib/prismaclient";

async function verifyMigration() {
  console.log("🔍 Verifying dialogue provenance migration results...\n");

  // Check Arguments
  const totalArguments = await prisma.argument.count();
  const argumentsWithProvenance = await prisma.argument.count({
    where: { createdByMoveId: { not: null } }
  });
  
  console.log("📊 Arguments:");
  console.log(`   Total: ${totalArguments}`);
  console.log(`   With dialogue provenance: ${argumentsWithProvenance}`);
  console.log(`   Percentage: ${((argumentsWithProvenance / totalArguments) * 100).toFixed(1)}%`);

  // Sample argument with provenance
  if (argumentsWithProvenance > 0) {
    const sampleArg = await prisma.argument.findFirst({
      where: { createdByMoveId: { not: null } },
      include: {
        createdByMove: {
          select: { id: true, kind: true, createdAt: true, actorId: true }
        }
      }
    });
    
    if (sampleArg) {
      console.log(`\n   Sample argument with provenance:`);
      console.log(`   - Argument ID: ${sampleArg.id}`);
      console.log(`   - Created by move: ${sampleArg.createdByMove?.kind} (${sampleArg.createdByMove?.id.slice(0, 8)})`);
      console.log(`   - Move timestamp: ${sampleArg.createdByMove?.createdAt}`);
    }
  }

  // Check ConflictApplications
  const totalConflicts = await prisma.conflictApplication.count();
  const conflictsWithProvenance = await prisma.conflictApplication.count({
    where: { createdByMoveId: { not: null } }
  });
  
  console.log("\n📊 ConflictApplications:");
  console.log(`   Total: ${totalConflicts}`);
  console.log(`   With dialogue provenance: ${conflictsWithProvenance}`);
  if (totalConflicts > 0) {
    console.log(`   Percentage: ${((conflictsWithProvenance / totalConflicts) * 100).toFixed(1)}%`);
  }

  // Check DialogueVisualizationNodes
  const totalVizNodes = await prisma.dialogueVisualizationNode.count();
  const nodesByKind = await prisma.dialogueVisualizationNode.groupBy({
    by: ["nodeKind"],
    _count: { nodeKind: true }
  });

  console.log("\n📊 DialogueVisualizationNodes:");
  console.log(`   Total: ${totalVizNodes}`);
  console.log(`   By kind:`);
  for (const group of nodesByKind) {
    console.log(`   - ${group.nodeKind}: ${group._count.nodeKind}`);
  }

  // Sample visualization node
  if (totalVizNodes > 0) {
    const sampleVizNode = await prisma.dialogueVisualizationNode.findFirst({
      include: {
        dialogueMove: {
          select: { id: true, kind: true, targetType: true, targetId: true, createdAt: true }
        }
      }
    });

    if (sampleVizNode) {
      console.log(`\n   Sample visualization node:`);
      console.log(`   - Node ID: ${sampleVizNode.id}`);
      console.log(`   - Kind: ${sampleVizNode.nodeKind}`);
      console.log(`   - Dialogue move: ${sampleVizNode.dialogueMove.kind}`);
      console.log(`   - Target: ${sampleVizNode.dialogueMove.targetType}/${sampleVizNode.dialogueMove.targetId.slice(0, 8)}`);
      console.log(`   - Metadata: ${JSON.stringify(sampleVizNode.metadata, null, 2)}`);
    }
  }

  // Check overall DialogueMoves stats
  const totalMoves = await prisma.dialogueMove.count();
  const movesByKind = await prisma.dialogueMove.groupBy({
    by: ["kind"],
    _count: { kind: true }
  });

  console.log("\n📊 DialogueMoves (overall stats):");
  console.log(`   Total: ${totalMoves}`);
  console.log(`   Top kinds:`);
  movesByKind
    .sort((a, b) => b._count.kind - a._count.kind)
    .slice(0, 10)
    .forEach((group) => {
      console.log(`   - ${group.kind}: ${group._count.kind}`);
    });

  console.log("\n✅ Verification complete!");
}

verifyMigration()
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
