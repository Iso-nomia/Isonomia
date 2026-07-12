-- Migration: Add metaJson to ConflictApplication
-- Purpose: Track which CQ an attack addresses for automatic satisfaction
-- Date: 2025-10-21
-- Phase: 2 (Fix #3)

-- Add metaJson column to store CQ context
ALTER TABLE "ConflictApplication"
ADD COLUMN IF NOT EXISTS "metaJson" JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN "ConflictApplication"."metaJson" IS
'Metadata tracking which critical question this attack addresses. Format: { schemeKey: string, cqKey: string, source: string }';

-- Create index for efficient queries on CQ key
CREATE INDEX IF NOT EXISTS "ConflictApplication_metaJson_cqKey_idx"
ON "ConflictApplication" USING gin (("metaJson"));

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ConflictApplication'
    AND column_name = 'metaJson'
  ) THEN
    RAISE NOTICE 'Migration successful: metaJson column added to ConflictApplication';
  ELSE
    RAISE EXCEPTION 'Migration failed: metaJson column not found';
  END IF;
END $$;
