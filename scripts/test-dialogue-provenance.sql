-- Test Dialogue Provenance Implementation
-- Phase 1.1: Dialogue Provenance System
-- Tasks 8-10: Comprehensive validation queries

-- This script provides diagnostic queries to validate:
-- 1. GROUNDS moves populate argumentId field
-- 2. Arguments are linked to GROUNDS moves via createdByMoveId
-- 3. ConflictApplications are linked to ATTACK moves via createdByMoveId
-- 4. ATTACK moves exist and are properly created
-- 5. Overall dialogue provenance coverage

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo '  PHASE 1.1: DIALOGUE PROVENANCE VALIDATION'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

-- ========================================
-- TEST 1: DialogueMove Field Population
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 1: DialogueMove Field Population by Kind          │'
\echo '└─────────────────────────────────────────────────────────┘'
SELECT 
  kind,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "argumentId" IS NOT NULL) AS "has_argumentId",
  ROUND(
    COUNT(*) FILTER (WHERE "argumentId" IS NOT NULL)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) AS "argumentId_coverage_%"
FROM "DialogueMove"
WHERE kind IN ('GROUNDS', 'WHY', 'ATTACK', 'RETRACT')
GROUP BY kind
ORDER BY kind;

\echo ''

-- ========================================
-- TEST 2: GROUNDS Move Validation
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 2: GROUNDS Moves - Argument Linking Status        │'
\echo '└─────────────────────────────────────────────────────────┘'

-- Check if GROUNDS moves properly populate argumentId
WITH grounds_analysis AS (
  SELECT 
    dm.id,
    dm."targetType",
    dm."targetId",
    dm."argumentId",
    CASE 
      WHEN dm."targetType" = 'argument' THEN dm."targetId"
      WHEN (dm.payload->>'createdArgumentId') IS NOT NULL THEN dm.payload->>'createdArgumentId'
      ELSE NULL
    END AS expected_argument_id,
    CASE 
      WHEN dm."argumentId" IS NOT NULL THEN 'LINKED'
      WHEN dm."targetType" = 'argument' OR (dm.payload->>'createdArgumentId') IS NOT NULL THEN 'SHOULD_BE_LINKED'
      ELSE 'N/A'
    END AS status
  FROM "DialogueMove" dm
  WHERE dm.kind = 'GROUNDS'
)
SELECT 
  status,
  COUNT(*) AS count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM "DialogueMove" WHERE kind = 'GROUNDS') * 100, 2) AS percentage
FROM grounds_analysis
GROUP BY status
ORDER BY status;

\echo ''

-- Show sample GROUNDS moves (up to 5)
\echo '📋 Sample GROUNDS Moves:'
SELECT 
  dm.id,
  dm."targetType",
  dm."targetId",
  dm."argumentId",
  dm.payload->>'createdArgumentId' AS "payload_argId",
  dm."createdAt"
FROM "DialogueMove" dm
WHERE dm.kind = 'GROUNDS'
ORDER BY dm."createdAt" DESC
LIMIT 5;

\echo ''

-- ========================================
-- TEST 3: Argument Dialogue Provenance
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 3: Argument → GROUNDS Move Linkage                │'
\echo '└─────────────────────────────────────────────────────────┘'
SELECT 
  COUNT(*) AS total_arguments,
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked_to_move,
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NULL) AS no_provenance,
  ROUND(
    COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL)::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS "linked_percentage_%"
FROM "Argument";

\echo ''

-- Verify bidirectional linkage (Argument ↔ DialogueMove)
\echo '🔗 Bidirectional Linkage Check:'
SELECT 
  COUNT(DISTINCT a.id) AS arguments_with_move,
  COUNT(DISTINCT dm.id) AS grounds_moves_referenced,
  COUNT(*) FILTER (WHERE dm.kind = 'GROUNDS') AS valid_grounds_moves,
  COUNT(*) FILTER (WHERE dm.kind != 'GROUNDS' OR dm.kind IS NULL) AS invalid_move_kind
FROM "Argument" a
LEFT JOIN "DialogueMove" dm ON a."createdByMoveId" = dm.id
WHERE a."createdByMoveId" IS NOT NULL;

\echo ''

-- ========================================
-- TEST 4: ATTACK Move Validation
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 4: ATTACK DialogueMoves - Creation Status         │'
\echo '└─────────────────────────────────────────────────────────┘'
SELECT 
  COUNT(*) AS total_attack_moves,
  COUNT(*) FILTER (WHERE payload->>'backfilled' = 'true') AS backfilled,
  COUNT(*) FILTER (WHERE payload->>'backfilled' IS NULL OR payload->>'backfilled' = 'false') AS newly_created,
  MIN("createdAt") AS first_attack,
  MAX("createdAt") AS latest_attack
FROM "DialogueMove"
WHERE kind = 'ATTACK';

\echo ''

-- ========================================
-- TEST 5: ConflictApplication Provenance
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 5: ConflictApplication → ATTACK Move Linkage      │'
\echo '└─────────────────────────────────────────────────────────┘'
SELECT 
  COUNT(*) AS total_conflicts,
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked_to_attack,
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NULL) AS no_provenance,
  ROUND(
    COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL)::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS "linked_percentage_%"
FROM "ConflictApplication";

\echo ''

-- Verify bidirectional linkage (ConflictApplication ↔ ATTACK Move)
\echo '🔗 Bidirectional Linkage Check:'
SELECT 
  COUNT(DISTINCT ca.id) AS conflicts_with_move,
  COUNT(DISTINCT dm.id) AS attack_moves_referenced,
  COUNT(*) FILTER (WHERE dm.kind = 'ATTACK') AS valid_attack_moves,
  COUNT(*) FILTER (WHERE dm.kind != 'ATTACK' OR dm.kind IS NULL) AS invalid_move_kind
FROM "ConflictApplication" ca
LEFT JOIN "DialogueMove" dm ON ca."createdByMoveId" = dm.id
WHERE ca."createdByMoveId" IS NOT NULL;

\echo ''

-- ========================================
-- TEST 6: DialogueVisualizationNode Coverage
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 6: DialogueVisualizationNode Coverage             │'
\echo '└─────────────────────────────────────────────────────────┘'
SELECT 
  "nodeKind",
  COUNT(*) AS count,
  MIN("createdAt") AS first_created,
  MAX("createdAt") AS latest_created
FROM "DialogueVisualizationNode"
GROUP BY "nodeKind"
ORDER BY count DESC;

\echo ''

-- ========================================
-- TEST 7: Overall Dialogue Provenance Health
-- ========================================
\echo '┌─────────────────────────────────────────────────────────┐'
\echo '│ TEST 7: Overall System Health Summary                  │'
\echo '└─────────────────────────────────────────────────────────┘'
WITH metrics AS (
  SELECT 
    'DialogueMoves (All)' AS entity,
    COUNT(*) AS total,
    NULL::bigint AS linked,
    NULL::numeric AS coverage
  FROM "DialogueMove"
  
  UNION ALL
  
  SELECT 
    'DialogueMoves (GROUNDS)' AS entity,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE "argumentId" IS NOT NULL) AS linked,
    ROUND(
      COUNT(*) FILTER (WHERE "argumentId" IS NOT NULL)::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS coverage
  FROM "DialogueMove"
  WHERE kind = 'GROUNDS'
  
  UNION ALL
  
  SELECT 
    'DialogueMoves (ATTACK)' AS entity,
    COUNT(*) AS total,
    NULL AS linked,
    NULL AS coverage
  FROM "DialogueMove"
  WHERE kind = 'ATTACK'
  
  UNION ALL
  
  SELECT 
    'Arguments' AS entity,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked,
    ROUND(
      COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL)::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS coverage
  FROM "Argument"
  
  UNION ALL
  
  SELECT 
    'ConflictApplications' AS entity,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked,
    ROUND(
      COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL)::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS coverage
  FROM "ConflictApplication"
  
  UNION ALL
  
  SELECT 
    'DialogueVisualizationNodes' AS entity,
    COUNT(*) AS total,
    NULL AS linked,
    NULL AS coverage
  FROM "DialogueVisualizationNode"
)
SELECT * FROM metrics ORDER BY entity;

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo '  SUCCESS CRITERIA (Phase 1.1)'
\echo '═══════════════════════════════════════════════════════════'
\echo '  ✓ GROUNDS moves should have >80% argumentId coverage'
\echo '  ✓ Arguments should have >50% createdByMoveId coverage (new data)'
\echo '  ✓ ATTACK moves should exist (count > 0)'
\echo '  ✓ ConflictApplications should have >80% createdByMoveId coverage'
\echo '  ✓ No invalid move kinds in linkages'
\echo '═══════════════════════════════════════════════════════════'
\echo ''
