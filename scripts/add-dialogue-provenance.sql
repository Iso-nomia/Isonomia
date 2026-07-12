-- ============================================================================
-- Dialogue Provenance Backfill Migration
-- Phase 1.2: Link existing DialogueMoves to Arguments/ConflictApplications/Claims
-- ============================================================================
-- 
-- IMPORTANT: This script is IDEMPOTENT - safe to run multiple times
-- All updates use WHERE clauses to avoid overwriting existing links
--
-- What this does:
-- 1. Links GROUNDS moves → Arguments (via direct argumentId match)
-- 2. Links ATTACK moves → ConflictApplications (via timestamp + actor heuristics)
-- 3. Creates DialogueVisualizationNode for WHY, CONCEDE, RETRACT, CLOSE, ACCEPT_ARGUMENT moves
--
-- Architecture: Follows proven pattern from generate-debate-sheets.ts
-- See: DIALOGUE_VISUALIZATION_ROADMAP.md Phase 1.2
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Link GROUNDS moves to Arguments
-- ============================================================================
-- GROUNDS moves use targetType/targetId, NOT argumentId field
-- When targetType = 'argument', targetId is the Argument ID
-- Expected: High success rate

UPDATE "Argument" AS a
SET "createdByMoveId" = dm.id
FROM "DialogueMove" AS dm
WHERE 
  a.id = dm."targetId"
  AND dm.kind = 'GROUNDS'
  AND dm."targetType" = 'argument'
  AND a."createdByMoveId" IS NULL; -- Only update if not already linked

-- Log results
DO $$
DECLARE
  grounds_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO grounds_count 
  FROM "Argument" 
  WHERE "createdByMoveId" IS NOT NULL;
  
  RAISE NOTICE '✅ Step 1 Complete: % Arguments linked to GROUNDS moves', grounds_count;
END $$;

-- ============================================================================
-- STEP 2: Link ATTACK moves to ConflictApplications
-- ============================================================================
-- Uses timestamp heuristics: ±5 seconds + actor matching for disambiguation
-- Expected: Medium success rate (60-80% depending on deliberation activity)

-- First pass: Link ATTACK moves where there's exactly ONE matching ConflictApplication
-- within ±5 seconds window
WITH candidate_matches AS (
  SELECT 
    ca_inner.id AS conflict_id,
    dm.id AS move_id,
    ABS(EXTRACT(EPOCH FROM (dm."createdAt" - ca_inner."createdAt"))) AS time_diff,
    COUNT(*) OVER (PARTITION BY ca_inner.id) AS match_count
  FROM "ConflictApplication" AS ca_inner
  JOIN "DialogueMove" AS dm 
    ON dm."deliberationId" = ca_inner."deliberationId"
    AND dm.kind = 'ATTACK'
    AND dm."createdAt" BETWEEN (ca_inner."createdAt" - INTERVAL '5 seconds') 
                           AND (ca_inner."createdAt" + INTERVAL '5 seconds')
    AND ca_inner."createdById" = dm."actorId" -- Actor must match
  WHERE ca_inner."createdByMoveId" IS NULL -- Only update unlinked conflicts
),
single_matches AS (
  SELECT DISTINCT ON (conflict_id)
    conflict_id,
    move_id
  FROM candidate_matches
  WHERE match_count = 1 -- Only if single match
  ORDER BY conflict_id, time_diff
)
UPDATE "ConflictApplication" AS ca
SET "createdByMoveId" = sm.move_id
FROM single_matches AS sm
WHERE ca.id = sm.conflict_id;

-- Log results
DO $$
DECLARE
  attack_count INTEGER;
  total_conflicts INTEGER;
BEGIN
  SELECT COUNT(*) INTO attack_count 
  FROM "ConflictApplication" 
  WHERE "createdByMoveId" IS NOT NULL;
  
  SELECT COUNT(*) INTO total_conflicts
  FROM "ConflictApplication";
  
  RAISE NOTICE '✅ Step 2 Complete: % / % ConflictApplications linked to ATTACK moves', 
    attack_count, total_conflicts;
END $$;

-- ============================================================================
-- STEP 3: Create DialogueVisualizationNodes for pure dialogue moves
-- ============================================================================
-- These are moves that don't create Arguments or Conflicts but still need visualization
-- Move kinds: WHY, CONCEDE, RETRACT, CLOSE, ACCEPT_ARGUMENT

INSERT INTO "DialogueVisualizationNode" (
  id,
  "deliberationId",
  "dialogueMoveId",
  "nodeKind",
  metadata,
  "createdAt"
)
SELECT
  gen_random_uuid(), -- Generate new UUID for each node
  dm."deliberationId",
  dm.id,
  dm.kind,
  jsonb_build_object(
    'targetType', dm."targetType",
    'targetId', dm."targetId",
    'replyToMoveId', dm."replyToMoveId",
    'payload', dm.payload
  ),
  dm."createdAt"
FROM "DialogueMove" AS dm
WHERE 
  dm.kind IN ('WHY', 'CONCEDE', 'RETRACT', 'CLOSE', 'ACCEPT_ARGUMENT')
  AND NOT EXISTS (
    -- Skip if visualization node already exists for this move
    SELECT 1 
    FROM "DialogueVisualizationNode" AS dvn 
    WHERE dvn."dialogueMoveId" = dm.id
  );

-- Log results
DO $$
DECLARE
  viz_node_count INTEGER;
  why_count INTEGER;
  concede_count INTEGER;
  retract_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO viz_node_count 
  FROM "DialogueVisualizationNode";
  
  SELECT COUNT(*) INTO why_count
  FROM "DialogueVisualizationNode"
  WHERE "nodeKind" = 'WHY';
  
  SELECT COUNT(*) INTO concede_count
  FROM "DialogueVisualizationNode"
  WHERE "nodeKind" = 'CONCEDE';
  
  SELECT COUNT(*) INTO retract_count
  FROM "DialogueVisualizationNode"
  WHERE "nodeKind" = 'RETRACT';
  
  RAISE NOTICE '✅ Step 3 Complete: % DialogueVisualizationNodes created', viz_node_count;
  RAISE NOTICE '   - WHY: %', why_count;
  RAISE NOTICE '   - CONCEDE: %', concede_count;
  RAISE NOTICE '   - RETRACT: %', retract_count;
END $$;

-- ============================================================================
-- STEP 4 (OPTIONAL): Link Claims to introducing DialogueMoves
-- ============================================================================
-- NOTE: This is harder to backfill since Claims don't directly reference DialogueMoves
-- For now, we'll skip this and let it be populated for new claims going forward
-- Future enhancement: Could use ArgumentPremise creation time + GROUNDS move timestamps

-- SKIPPED - Will be populated for new claims created after this migration

RAISE NOTICE '⚠️  Step 4 Skipped: Claim linking will be populated for new claims going forward';

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
DECLARE
  total_moves INTEGER;
  linked_arguments INTEGER;
  linked_conflicts INTEGER;
  linked_claims INTEGER;
  viz_nodes INTEGER;
  unlinked_attacks INTEGER;
BEGIN
  -- Count totals
  SELECT COUNT(*) INTO total_moves FROM "DialogueMove";
  SELECT COUNT(*) INTO linked_arguments FROM "Argument" WHERE "createdByMoveId" IS NOT NULL;
  SELECT COUNT(*) INTO linked_conflicts FROM "ConflictApplication" WHERE "createdByMoveId" IS NOT NULL;
  SELECT COUNT(*) INTO linked_claims FROM "Claim" WHERE "introducedByMoveId" IS NOT NULL;
  SELECT COUNT(*) INTO viz_nodes FROM "DialogueVisualizationNode";
  
  SELECT COUNT(*) INTO unlinked_attacks 
  FROM "DialogueMove" dm
  WHERE dm.kind = 'ATTACK' 
  AND NOT EXISTS (
    SELECT 1 FROM "ConflictApplication" ca 
    WHERE ca."createdByMoveId" = dm.id
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  DIALOGUE PROVENANCE MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total DialogueMoves:              %', total_moves;
  RAISE NOTICE 'Arguments linked (GROUNDS):       %', linked_arguments;
  RAISE NOTICE 'Conflicts linked (ATTACK):        %', linked_conflicts;
  RAISE NOTICE 'Claims linked:                    %', linked_claims;
  RAISE NOTICE 'Visualization nodes created:      %', viz_nodes;
  RAISE NOTICE '';
  RAISE NOTICE 'Unlinked ATTACK moves:            %', unlinked_attacks;
  IF unlinked_attacks > 0 THEN
    RAISE NOTICE '  (These may be ambiguous or have no matching ConflictApplication)';
  END IF;
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these separately to check results)
-- ============================================================================

Check GROUNDS linkage success rate
SELECT 
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) / COUNT(*), 2) AS success_rate_pct
FROM "Argument";

-- Check ATTACK linkage success rate
SELECT 
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) / COUNT(*), 2) AS success_rate_pct
FROM "ConflictApplication";

-- Check DialogueVisualizationNode creation by kind
SELECT 
  "nodeKind",
  COUNT(*) AS count
FROM "DialogueVisualizationNode"
GROUP BY "nodeKind"
ORDER BY count DESC;

-- Find unlinked ATTACK moves (for troubleshooting)
SELECT 
  dm.id,
  dm."deliberationId",
  dm."createdAt",
  dm."actorId",
  (SELECT COUNT(*) 
   FROM "ConflictApplication" ca 
   WHERE ca."deliberationId" = dm."deliberationId"
   AND ca."createdAt" BETWEEN (dm."createdAt" - INTERVAL '5 seconds') 
                          AND (dm."createdAt" + INTERVAL '5 seconds')
  ) AS nearby_conflicts
FROM "DialogueMove" dm
WHERE dm.kind = 'ATTACK'
AND NOT EXISTS (
  SELECT 1 FROM "ConflictApplication" ca WHERE ca."createdByMoveId" = dm.id
)
LIMIT 20;
