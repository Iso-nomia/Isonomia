-- CQ Enhancements Migration
-- Date: 2025-01-07
-- Purpose: Add CQ metadata tracking, linkage table, and performance optimizations

-- 1. Add metaJson to ClaimEdge for CQ provenance tracking
ALTER TABLE "ClaimEdge" 
ADD COLUMN IF NOT EXISTS "metaJson" JSONB DEFAULT '{}'::jsonb;

-- 2. Create CQAttack linkage table
CREATE TABLE IF NOT EXISTS "CQAttack" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cqStatusId" TEXT NOT NULL,
  "conflictApplicationId" TEXT,
  "claimEdgeId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CQAttack_cqStatusId_fkey" FOREIGN KEY ("cqStatusId") 
    REFERENCES "CQStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT "CQAttack_conflictApplicationId_fkey" FOREIGN KEY ("conflictApplicationId") 
    REFERENCES "ConflictApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT "CQAttack_claimEdgeId_fkey" FOREIGN KEY ("claimEdgeId") 
    REFERENCES "ClaimEdge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Create indexes for CQAttack
CREATE INDEX IF NOT EXISTS "CQAttack_cqStatusId_idx" ON "CQAttack"("cqStatusId");
CREATE INDEX IF NOT EXISTS "CQAttack_conflictApplicationId_idx" ON "CQAttack"("conflictApplicationId");
CREATE INDEX IF NOT EXISTS "CQAttack_claimEdgeId_idx" ON "CQAttack"("claimEdgeId");

-- 4. Add GIN index on DialogueMove.payload for fast cqKey lookups
-- This optimizes the O(n*m) loop in /api/cqs route to O(1) aggregated query
CREATE INDEX IF NOT EXISTS "DialogueMove_payload_cqKey_idx" 
ON "DialogueMove" USING GIN ((payload -> 'cqKey'));

-- 5. Optional: Add comment explaining the optimization
COMMENT ON INDEX "DialogueMove_payload_cqKey_idx" IS 
'GIN index for fast JSONB cqKey lookups in DialogueMove.payload. Enables efficient aggregation queries for CQ dialogue move counts.';
