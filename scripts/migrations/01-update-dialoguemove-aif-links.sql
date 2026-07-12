-- Migration: Update DialogueMove.aifRepresentation with DM-node IDs
-- Phase: 1.4 - Dialogue Visualization Roadmap
-- Date: November 2, 2025
-- 
-- Prerequisites:
-- - AifNode table must exist
-- - AifEdge table must exist
-- - DM-nodes must already be created (with dialogueMoveId set)
-- 
-- Purpose:
-- This script updates the DialogueMove.aifRepresentation field to link
-- each dialogue move to its corresponding DM-node in the AIF graph.
--
-- Usage:
-- 1. Open Supabase SQL Editor
-- 2. Paste this entire script
-- 3. Execute
-- 4. Verify: SELECT COUNT(*) FROM "DialogueMove" WHERE "aifRepresentation" IS NOT NULL;

-- Update DialogueMove.aifRepresentation for all moves that have DM-nodes
UPDATE "DialogueMove" dm
SET "aifRepresentation" = an.id
FROM aif_nodes an
WHERE an."dialogueMoveId" = dm.id
  AND an."nodeKind" = 'DM'
  AND dm."aifRepresentation" IS NULL;

-- Verification queries (uncomment to run):
-- SELECT COUNT(*) AS total_moves FROM "DialogueMove";
-- SELECT COUNT(*) AS moves_with_aif FROM "DialogueMove" WHERE "aifRepresentation" IS NOT NULL;
-- SELECT COUNT(*) AS dm_nodes FROM aif_nodes WHERE "nodeKind" = 'DM';
