#!/usr/bin/env tsx
/**
 * Update DialogueMove.aifRepresentation to link to DM-nodes
 * Run this after AIF nodes have been created
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateDialogueMoves() {
  try {
    console.log("Fetching all DM-nodes...");
    
    const dmNodes = await prisma.$queryRaw<any[]>`
      SELECT id, "dialogueMoveId" 
      FROM "AifNode" 
      WHERE "nodeKind" = 'DM' 
      AND "dialogueMoveId" IS NOT NULL
    `;
    
    console.log(`Found ${dmNodes.length} DM-nodes to link`);
    
    let updated = 0;
    let errors = 0;
    
    for (const node of dmNodes) {
      try {
        await prisma.$executeRaw`
          UPDATE "DialogueMove"
          SET "aifRepresentation" = ${node.id}
          WHERE id = ${node.dialogueMoveId}
        `;
        updated++;
        
        if (updated % 50 === 0) {
          console.log(`  Updated ${updated}/${dmNodes.length}...`);
        }
      } catch (error: any) {
        console.error(`  Error updating move ${node.dialogueMoveId}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Update complete!`);
    console.log(`  Successfully updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    
    // Verify
    const verifyCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) FROM "DialogueMove" WHERE "aifRepresentation" IS NOT NULL
    `;
    console.log(`  Dialogue moves with aifRepresentation: ${verifyCount[0].count}`);
    
  } catch (error) {
    console.error("❌ Update failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateDialogueMoves();
