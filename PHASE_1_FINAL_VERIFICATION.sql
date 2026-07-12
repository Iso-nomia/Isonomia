-- ═══════════════════════════════════════════════════════════
-- PHASE 1.1: DIALOGUE PROVENANCE - FINAL VERIFICATION
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to verify all fixes are working
-- Expected: All metrics should show >80% coverage for new data

-- ========================================
-- TEST 1: DialogueMove Field Population
-- ========================================
-- Expected: GROUNDS moves with argumentId, ATTACK moves exist
SELECT 
  'TEST 1: DialogueMove Field Population' AS test_name,
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

-- ========================================
-- TEST 2: GROUNDS Moves - Latest 10
-- ========================================
-- Expected: Recent GROUNDS moves should have argumentId populated
SELECT 
  'TEST 2: Latest GROUNDS Moves' AS test_name,
  dm.id,
  dm."targetType",
  dm."argumentId",
  dm.payload->>'createdArgumentId' AS "payload_argId",
  CASE 
    WHEN dm."argumentId" IS NOT NULL THEN '✅ LINKED'
    ELSE '❌ NOT LINKED'
  END AS status,
  dm."createdAt"
FROM "DialogueMove" dm
WHERE dm.kind = 'GROUNDS'
ORDER BY dm."createdAt" DESC
LIMIT 10;

-- ========================================
-- TEST 3: Argument Bidirectional Linkage
-- ========================================
-- Expected: >50% of Arguments should have createdByMoveId (new data)
SELECT 
  'TEST 3: Argument Provenance' AS test_name,
  COUNT(*) AS total_arguments,
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked_to_move,
  ROUND(
    COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL)::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS "linked_percentage_%"
FROM "Argument";

-- Verify bidirectional linkage integrity
SELECT 
  'TEST 3b: Bidirectional Integrity' AS test_name,
  COUNT(DISTINCT a.id) AS arguments_with_move,
  COUNT(DISTINCT dm.id) AS grounds_moves_referenced,
  COUNT(*) FILTER (WHERE dm.kind = 'GROUNDS') AS valid_grounds_moves,
  COUNT(*) FILTER (WHERE dm.kind != 'GROUNDS') AS invalid_move_kind
FROM "Argument" a
LEFT JOIN "DialogueMove" dm ON a."createdByMoveId" = dm.id
WHERE a."createdByMoveId" IS NOT NULL;

-- ========================================
-- TEST 4: ATTACK Moves
-- ========================================
-- Expected: 22+ ATTACK moves (22 backfilled + new ones)
SELECT 
  'TEST 4: ATTACK DialogueMoves' AS test_name,
  COUNT(*) AS total_attack_moves,
  COUNT(*) FILTER (WHERE payload->>'backfilled' = 'true') AS backfilled,
  COUNT(*) FILTER (WHERE payload->>'backfilled' IS NULL OR payload->>'backfilled' = 'false') AS newly_created,
  MIN("createdAt") AS first_attack,
  MAX("createdAt") AS latest_attack
FROM "DialogueMove"
WHERE kind = 'ATTACK';

-- ========================================
-- TEST 5: ConflictApplication Linkage
-- ========================================
-- Expected: 100% ConflictApplications should have createdByMoveId
SELECT 
  'TEST 5: ConflictApplication Provenance' AS test_name,
  COUNT(*) AS total_conflicts,
  COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL) AS linked_to_attack,
  ROUND(
    COUNT(*) FILTER (WHERE "createdByMoveId" IS NOT NULL)::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS "linked_percentage_%"
FROM "ConflictApplication";

-- Verify bidirectional linkage integrity
SELECT 
  'TEST 5b: Bidirectional Integrity' AS test_name,
  COUNT(DISTINCT ca.id) AS conflicts_with_move,
  COUNT(DISTINCT dm.id) AS attack_moves_referenced,
  COUNT(*) FILTER (WHERE dm.kind = 'ATTACK') AS valid_attack_moves,
  COUNT(*) FILTER (WHERE dm.kind != 'ATTACK') AS invalid_move_kind
FROM "ConflictApplication" ca
LEFT JOIN "DialogueMove" dm ON ca."createdByMoveId" = dm.id
WHERE ca."createdByMoveId" IS NOT NULL;

-- ========================================
-- TEST 6: Latest answer-and-commit Test
-- ========================================
-- Expected: answer-and-commit GROUNDS move should show bidirectional linkage
SELECT 
  'TEST 6: answer-and-commit Verification' AS test_name,
  dm.id AS move_id,
  dm.kind,
  dm."argumentId" AS move_arg_id,
  a.id AS argument_id,
  a."createdByMoveId" AS arg_created_by_move_id,
  CASE 
    WHEN dm."argumentId" = a.id AND a."createdByMoveId" = dm.id 
    THEN '✅ BIDIRECTIONAL' 
    ELSE '❌ BROKEN' 
  END AS linkage_status,
  dm."createdAt"
FROM "DialogueMove" dm
LEFT JOIN "Argument" a ON a.id = dm."argumentId"
WHERE dm.id = 'cmhisuvoj0026g14t2ukg97q7'; -- Latest test move

-- ========================================
-- TEST 7: Overall System Health
-- ========================================
WITH metrics AS (
  SELECT 
    'DialogueMoves (GROUNDS)' AS entity,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE "argumentId" IS NOT NULL) AS linked,
    ROUND(
      COUNT(*) FILTER (WHERE "argumentId" IS NOT NULL)::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS coverage,
    1 AS sort_order
  FROM "DialogueMove"
  WHERE kind = 'GROUNDS'
  
  UNION ALL
  
  SELECT 
    'DialogueMoves (ATTACK)' AS entity,
    COUNT(*) AS total,
    NULL AS linked,
    NULL AS coverage,
    2 AS sort_order
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
    ) AS coverage,
    3 AS sort_order
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
    ) AS coverage,
    4 AS sort_order
  FROM "ConflictApplication"
  
  UNION ALL
  
  SELECT 
    'DialogueVisualizationNodes' AS entity,
    COUNT(*) AS total,
    NULL AS linked,
    NULL AS coverage,
    5 AS sort_order
  FROM "DialogueVisualizationNode"
)
SELECT 
  'TEST 7: System Health Summary' AS test_name,
  entity,
  total,
  linked,
  CASE 
    WHEN coverage IS NOT NULL THEN coverage || '%'
    ELSE 'N/A'
  END AS coverage
FROM metrics 
ORDER BY sort_order;

-- ═══════════════════════════════════════════════════════════
-- SUCCESS CRITERIA (Phase 1.1)
-- ═══════════════════════════════════════════════════════════
-- ✅ GROUNDS moves: Latest moves should have 100% argumentId coverage
-- ✅ Arguments: >50% should have createdByMoveId (historical data expected to be low)
-- ✅ ATTACK moves: Should exist (22+ total: 22 backfilled + new ones)
-- ✅ ConflictApplications: 100% should have createdByMoveId linkage
-- ✅ No invalid move kinds in bidirectional linkages
-- ✅ answer-and-commit test move should show BIDIRECTIONAL status
-- ═══════════════════════════════════════════════════════════
