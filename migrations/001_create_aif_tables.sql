-- Create AifNode and AifEdge tables for Dialogue Visualization System
-- Phase 1.1 Database Schema Extensions
-- Date: November 2, 2025

-- Create AifNode table
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
    "schemeKey" TEXT,
    
    -- Foreign key constraints
    CONSTRAINT "AifNode_deliberationId_fkey" FOREIGN KEY ("deliberationId") REFERENCES "Deliberation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AifNode_argumentId_fkey" FOREIGN KEY ("argumentId") REFERENCES "Argument"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AifNode_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AifNode_dialogueMoveId_fkey" FOREIGN KEY ("dialogueMoveId") REFERENCES "DialogueMove"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create AifEdge table
CREATE TABLE IF NOT EXISTS "AifEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliberationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "edgeRole" TEXT NOT NULL,
    "causedByMoveId" TEXT,
    "metadata" JSONB,
    
    -- Foreign key constraints
    CONSTRAINT "AifEdge_deliberationId_fkey" FOREIGN KEY ("deliberationId") REFERENCES "Deliberation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AifEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AifNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AifEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "AifNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AifEdge_causedByMoveId_fkey" FOREIGN KEY ("causedByMoveId") REFERENCES "DialogueMove"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for AifNode
CREATE INDEX IF NOT EXISTS "AifNode_deliberationId_idx" ON "AifNode"("deliberationId");
CREATE INDEX IF NOT EXISTS "AifNode_nodeKind_idx" ON "AifNode"("nodeKind");
CREATE INDEX IF NOT EXISTS "AifNode_dialogueMoveId_idx" ON "AifNode"("dialogueMoveId");
CREATE INDEX IF NOT EXISTS "AifNode_argumentId_claimId_idx" ON "AifNode"("argumentId", "claimId");

-- Create indexes for AifEdge
CREATE INDEX IF NOT EXISTS "AifEdge_deliberationId_idx" ON "AifEdge"("deliberationId");
CREATE INDEX IF NOT EXISTS "AifEdge_sourceId_idx" ON "AifEdge"("sourceId");
CREATE INDEX IF NOT EXISTS "AifEdge_targetId_idx" ON "AifEdge"("targetId");
CREATE INDEX IF NOT EXISTS "AifEdge_causedByMoveId_idx" ON "AifEdge"("causedByMoveId");

-- Add new column to DialogueMove (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='DialogueMove' 
                   AND column_name='aifRepresentation') THEN
        ALTER TABLE "DialogueMove" ADD COLUMN "aifRepresentation" TEXT UNIQUE;
        CREATE UNIQUE INDEX IF NOT EXISTS "DialogueMove_aifRepresentation_key" ON "DialogueMove"("aifRepresentation");
    END IF;
END $$;
