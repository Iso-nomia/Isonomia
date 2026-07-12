-- Migration: Create AIF Nodes and Edges for Dialogue Moves
-- Phase: 1.4 - Dialogue Visualization Roadmap
-- Date: November 2, 2025
-- 
-- Purpose:
-- This script creates DM-nodes (Dialogue Move nodes) and their corresponding
-- edges in the AIF graph for all existing DialogueMoves.
--
-- Prerequisites:
-- - AifNode table must exist
-- - AifEdge table must exist
-- - DialogueMove table must have data
--
-- What this does:
-- 1. Creates a DM-node for each DialogueMove
-- 2. Creates edges linking DM-nodes to parent moves (triggers/answers)
-- 3. Creates edges linking DM-nodes to argument/claim nodes (repliesTo/commitsTo)
--
-- Usage:
-- 1. Open Supabase SQL Editor
-- 2. Paste this entire script
-- 3. Execute
-- 4. Verify with queries at the bottom

-- ============================================================================
-- PART 1: Create DM-nodes for all DialogueMoves
-- ============================================================================

INSERT INTO aif_nodes (
  id,
  "deliberationId",
  "nodeKind",
  "nodeSubtype",
  "dialogueMoveId",
  "dialogueMetadata",
  "createdAt",
  "updatedAt"
)
SELECT 
  'DM:' || dm.id AS id,
  dm."deliberationId",
  'DM' AS "nodeKind",
  dm.kind AS "nodeSubtype",
  dm.id AS "dialogueMoveId",
  jsonb_build_object(
    'locution', CASE 
      WHEN dm.kind IN ('WHY', 'GROUNDS') THEN 'question'
      ELSE 'assertion'
    END,
    'speaker', dm."actorId",
    'timestamp', dm."createdAt"::text,
    'replyToMoveId', dm."replyToMoveId",
    'claimId', CASE WHEN dm."targetType" = 'claim' THEN dm."targetId" ELSE NULL END
  ) AS "dialogueMetadata",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM "DialogueMove" dm
WHERE NOT EXISTS (
  SELECT 1 FROM aif_nodes 
  WHERE id = 'DM:' || dm.id
);

-- ============================================================================
-- PART 2: Create edges for reply relationships (triggers/answers)
-- ============================================================================

INSERT INTO aif_edges (
  id,
  "deliberationId",
  "sourceId",
  "targetId",
  "edgeRole",
  "causedByMoveId",
  "createdAt"
)
SELECT 
  'edge:' || dm.id || ':' || 
    CASE WHEN dm.kind IN ('WHY', 'GROUNDS') THEN 'triggers' ELSE 'answers' END || 
    ':' || dm."replyToMoveId" AS id,
  dm."deliberationId",
  'DM:' || dm.id AS "sourceId",
  'DM:' || dm."replyToMoveId" AS "targetId",
  CASE WHEN dm.kind IN ('WHY', 'GROUNDS') THEN 'triggers' ELSE 'answers' END AS "edgeRole",
  dm.id AS "causedByMoveId",
  NOW() AS "createdAt"
FROM "DialogueMove" dm
WHERE dm."replyToMoveId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM aif_nodes WHERE id = 'DM:' || dm."replyToMoveId")
  AND NOT EXISTS (
    SELECT 1 FROM aif_edges 
    WHERE id = 'edge:' || dm.id || ':' || 
      CASE WHEN dm.kind IN ('WHY', 'GROUNDS') THEN 'triggers' ELSE 'answers' END || 
      ':' || dm."replyToMoveId"
  );

-- ============================================================================
-- PART 3: Create edges linking DM-nodes to claim nodes (commitsTo)
-- ============================================================================

INSERT INTO aif_edges (
  id,
  "deliberationId",
  "sourceId",
  "targetId",
  "edgeRole",
  "causedByMoveId",
  "createdAt"
)
SELECT 
  'edge:' || dm.id || ':commitsTo:' || dm."targetId" AS id,
  dm."deliberationId",
  'DM:' || dm.id AS "sourceId",
  'I:' || dm."targetId" AS "targetId",
  'commitsTo' AS "edgeRole",
  dm.id AS "causedByMoveId",
  NOW() AS "createdAt"
FROM "DialogueMove" dm
WHERE dm."targetType" = 'claim'
  AND dm."targetId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM aif_nodes WHERE id = 'I:' || dm."targetId")
  AND NOT EXISTS (
    SELECT 1 FROM aif_edges 
    WHERE id = 'edge:' || dm.id || ':commitsTo:' || dm."targetId"
  );

-- ============================================================================
-- PART 4: Create edges linking DM-nodes to argument nodes (repliesTo)
-- ============================================================================

INSERT INTO aif_edges (
  id,
  "deliberationId",
  "sourceId",
  "targetId",
  "edgeRole",
  "causedByMoveId",
  "createdAt"
)
SELECT 
  'edge:' || dm.id || ':repliesTo:' || dm."targetId" AS id,
  dm."deliberationId",
  'DM:' || dm.id AS "sourceId",
  'RA:' || dm."targetId" AS "targetId",
  'repliesTo' AS "edgeRole",
  dm.id AS "causedByMoveId",
  NOW() AS "createdAt"
FROM "DialogueMove" dm
WHERE dm."targetType" = 'argument'
  AND dm."targetId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM aif_nodes WHERE id = 'RA:' || dm."targetId")
  AND NOT EXISTS (
    SELECT 1 FROM aif_edges 
    WHERE id = 'edge:' || dm.id || ':repliesTo:' || dm."targetId"
  );

-- ============================================================================
-- PART 5: Create edges linking DM-nodes to GROUNDS arguments (repliesTo)
-- ============================================================================

INSERT INTO aif_edges (
  id,
  "deliberationId",
  "sourceId",
  "targetId",
  "edgeRole",
  "causedByMoveId",
  "createdAt"
)
SELECT 
  'edge:' || dm.id || ':repliesTo:' || dm."argumentId" AS id,
  dm."deliberationId",
  'DM:' || dm.id AS "sourceId",
  'RA:' || dm."argumentId" AS "targetId",
  'repliesTo' AS "edgeRole",
  dm.id AS "causedByMoveId",
  NOW() AS "createdAt"
FROM "DialogueMove" dm
WHERE dm."argumentId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM aif_nodes WHERE id = 'RA:' || dm."argumentId")
  AND NOT EXISTS (
    SELECT 1 FROM aif_edges 
    WHERE id = 'edge:' || dm.id || ':repliesTo:' || dm."argumentId"
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Total DialogueMoves
SELECT COUNT(*) AS total_dialogue_moves FROM "DialogueMove";

-- DM-nodes created
SELECT COUNT(*) AS dm_nodes_created FROM aif_nodes WHERE "nodeKind" = 'DM';

-- Edges created by role
SELECT "edgeRole", COUNT(*) AS edge_count 
FROM aif_edges 
WHERE "causedByMoveId" IS NOT NULL
GROUP BY "edgeRole"
ORDER BY "edgeRole";

-- Total edges created for dialogue moves
SELECT COUNT(*) AS total_dialogue_edges 
FROM aif_edges 
WHERE "causedByMoveId" IS NOT NULL;

-- DialogueMoves without DM-nodes (should be 0)
SELECT COUNT(*) AS moves_without_dm_nodes
FROM "DialogueMove" dm
WHERE NOT EXISTS (
  SELECT 1 FROM aif_nodes 
  WHERE id = 'DM:' || dm.id
);

-- Sample DM-node with metadata
SELECT 
  id,
  "nodeKind",
  "nodeSubtype",
  "dialogueMoveId",
  "dialogueMetadata"
FROM aif_nodes 
WHERE "nodeKind" = 'DM'
LIMIT 3;

-- Sample edges
SELECT 
  id,
  "sourceId",
  "targetId",
  "edgeRole",
  "causedByMoveId"
FROM aif_edges 
WHERE "causedByMoveId" IS NOT NULL
LIMIT 10;
