#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTables() {
  try {
    console.log("Creating AifNode table...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "AifNode" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "deliberationId" TEXT NOT NULL,
        "nodeKind" TEXT NOT NULL,
        "nodeSubtype" TEXT,
        "argumentId" TEXT,
        "claimId" TEXT,
        "dialogueMoveId" TEXT,
        "dialogueMetadata" JSONB,
        "label" TEXT,
        "schemeKey" TEXT
      )
    `;
    
    console.log("Creating AifEdge table...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "AifEdge" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "deliberationId" TEXT NOT NULL,
        "sourceId" TEXT NOT NULL,
        "targetId" TEXT NOT NULL,
        "edgeRole" TEXT NOT NULL,
        "causedByMoveId" TEXT,
        "metadata" JSONB
      )
    `;
    
    console.log("Creating AifNode indexes...");
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifNode_deliberationId_idx" ON "AifNode"("deliberationId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifNode_nodeKind_idx" ON "AifNode"("nodeKind")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifNode_dialogueMoveId_idx" ON "AifNode"("dialogueMoveId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifNode_argumentId_claimId_idx" ON "AifNode"("argumentId", "claimId")`;
    
    console.log("Creating AifEdge indexes...");
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifEdge_deliberationId_idx" ON "AifEdge"("deliberationId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifEdge_sourceId_idx" ON "AifEdge"("sourceId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifEdge_targetId_idx" ON "AifEdge"("targetId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AifEdge_causedByMoveId_idx" ON "AifEdge"("causedByMoveId")`;
    
    console.log("Adding aifRepresentation column to DialogueMove...");
    // Check if column exists first
    const columnCheck = await prisma.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='DialogueMove' AND column_name='aifRepresentation'
    `;
    
    if (columnCheck.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "DialogueMove" ADD COLUMN "aifRepresentation" TEXT`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "DialogueMove_aifRepresentation_key" ON "DialogueMove"("aifRepresentation")`;
      console.log("  Column added successfully");
    } else {
      console.log("  Column already exists");
    }
    
    console.log("\n✅ Migration completed successfully!");
    console.log("\nTables created:");
    console.log("  - AifNode (with 4 indexes)");
    console.log("  - AifEdge (with 4 indexes)");
    console.log("  - DialogueMove.aifRepresentation column");
    
    // Verify tables exist
    console.log("\nVerifying tables...");
    const aifNodeExists = await prisma.$queryRaw<any[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'AifNode'
      )
    `;
    console.log("  AifNode exists:", aifNodeExists[0].exists);
    
    const aifEdgeExists = await prisma.$queryRaw<any[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'AifEdge'
      )
    `;
    console.log("  AifEdge exists:", aifEdgeExists[0].exists);
    
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTables();
