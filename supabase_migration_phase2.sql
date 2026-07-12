-- ============================================================================
-- Phase 2 Migration: Add metaJson to ConflictApplication
-- ============================================================================
-- Purpose: Track which critical question (CQ) an attack addresses
-- Usage: Copy-paste this entire script into Supabase SQL Editor and run
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- Add metaJson column
ALTER TABLE "ConflictApplication"
ADD COLUMN IF NOT EXISTS "metaJson" JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN "ConflictApplication"."metaJson" IS
'Tracks which critical question this attack addresses. Example: {"schemeKey": "ExpertOpinion", "cqKey": "eo-1", "source": "cq-inline-objection-rebut"}';

-- Create GIN index for efficient JSON queries
CREATE INDEX IF NOT EXISTS "ConflictApplication_metaJson_idx"
ON "ConflictApplication" USING gin ("metaJson");

-- Verify the migration succeeded
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'ConflictApplication'
    AND column_name = 'metaJson'
  ) THEN
    RAISE NOTICE '✓ Migration successful: metaJson column added to ConflictApplication';
  ELSE
    RAISE EXCEPTION '✗ Migration failed: metaJson column not found';
  END IF;
END $$;

-- Display sample of updated table structure
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ConflictApplication'
  AND column_name IN ('id', 'metaJson', 'legacyAttackType', 'createdAt')
ORDER BY ordinal_position;

-- Show count of existing records (will have empty metaJson by default)
SELECT
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE "metaJson" = '{}'::jsonb) as empty_metadata,
  COUNT(*) FILTER (WHERE "metaJson" != '{}'::jsonb) as with_metadata
FROM "ConflictApplication";
