-- Migration: Add Scoped Designs Architecture
-- Date: November 4, 2025
-- Purpose: Enable per-issue, per-actor-pair, or per-argument ludics designs

-- Add new columns to LudicDesign (nullable for backward compatibility)
ALTER TABLE "LudicDesign" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "LudicDesign" ADD COLUMN IF NOT EXISTS "scopeType" TEXT;
ALTER TABLE "LudicDesign" ADD COLUMN IF NOT EXISTS "scopeMetadata" JSONB;

-- Create indexes for efficient scope queries
CREATE INDEX IF NOT EXISTS "LudicDesign_deliberationId_scope_idx" 
  ON "LudicDesign"("deliberationId", "scope");

CREATE INDEX IF NOT EXISTS "LudicDesign_deliberationId_scopeType_idx" 
  ON "LudicDesign"("deliberationId", "scopeType");

CREATE INDEX IF NOT EXISTS "LudicDesign_deliberationId_participantId_scope_idx" 
  ON "LudicDesign"("deliberationId", "participantId", "scope");

-- Comment on columns
COMMENT ON COLUMN "LudicDesign"."scope" IS 'Scope identifier: issue:<id>, actors:<id1>:<id2>, argument:<id>, or null for legacy';
COMMENT ON COLUMN "LudicDesign"."scopeType" IS 'Scope type: issue, actor-pair, argument, or null for legacy';
COMMENT ON COLUMN "LudicDesign"."scopeMetadata" IS 'Scope metadata: {label, actors, issueId, argumentId, moveCount, timeRange, ...}';

-- Backfill existing designs with scope=null (legacy mode)
-- This ensures backward compatibility - existing designs continue to work as global P/O pairs
UPDATE "LudicDesign" 
SET "scope" = NULL, "scopeType" = NULL, "scopeMetadata" = NULL 
WHERE "scope" IS NULL;
