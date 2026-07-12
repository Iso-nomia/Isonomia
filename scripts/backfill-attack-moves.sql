-- Backfill ATTACK DialogueMoves for Historical ConflictApplications
-- Phase 1.1: Dialogue Provenance System
-- Task 7: Create ATTACK moves for the 22 existing ConflictApplications that don't have createdByMoveId

-- This script:
-- 1. Creates ATTACK DialogueMoves for each ConflictApplication that lacks dialogue provenance
-- 2. Links ConflictApplications back to their ATTACK moves via createdByMoveId
-- 3. Is IDEMPOTENT - safe to run multiple times

-- Step 1: Create ATTACK DialogueMoves for unlinked ConflictApplications
-- Uses a CTE to generate data, then bulk inserts ATTACK moves
WITH unlinked_cas AS (
  SELECT 
    ca.id AS ca_id,
    ca."deliberationId",
    ca."createdById",
    ca."createdAt",
    CASE 
      WHEN ca."conflictedArgumentId" IS NOT NULL THEN 'argument'
      ELSE 'claim'
    END AS target_type,
    COALESCE(ca."conflictedArgumentId", ca."conflictedClaimId") AS target_id,
    COALESCE(ca."legacyAttackType", 'REBUTS') AS attack_type,
    CASE ca."legacyAttackType"
      WHEN 'REBUTS' THEN 'I challenge this conclusion'
      WHEN 'UNDERCUTS' THEN 'I challenge the reasoning'
      WHEN 'UNDERMINES' THEN 'I challenge this premise'
      ELSE 'I challenge this'
    END AS expression,
    cs.key AS scheme_key
  FROM "ConflictApplication" ca
  LEFT JOIN "ConflictScheme" cs ON ca."schemeId" = cs.id
  WHERE ca."createdByMoveId" IS NULL
    AND COALESCE(ca."conflictedArgumentId", ca."conflictedClaimId") IS NOT NULL
),
inserted_moves AS (
  INSERT INTO "DialogueMove" (
    id,
    "deliberationId",
    "targetType",
    "targetId",
    kind,
    "actorId",
    payload,
    signature,
    "endsWithDaimon",
    "createdAt"
  )
  SELECT 
    gen_random_uuid()::text AS id,
    "deliberationId",
    target_type AS "targetType",
    target_id AS "targetId",
    'ATTACK' AS kind,
    "createdById" AS "actorId",
    jsonb_build_object(
      'attackType', attack_type,
      'expression', expression,
      'schemeKey', scheme_key,
      'locusPath', '0',
      'backfilled', true,
      'conflictApplicationId', ca_id
    ) AS payload,
    'ATTACK:' || target_type || ':' || target_id || ':backfill_' || ca_id AS signature,
    false AS "endsWithDaimon",
    "createdAt"
  FROM unlinked_cas
  ON CONFLICT ("deliberationId", signature) DO NOTHING
  RETURNING id, (payload->>'conflictApplicationId')::text AS ca_id
)
-- Step 2: Link ConflictApplications back to their new ATTACK moves
UPDATE "ConflictApplication" ca
SET "createdByMoveId" = im.id
FROM inserted_moves im
WHERE ca.id = im.ca_id;

-- Report results
DO $$
DECLARE
  attack_count INT;
  linked_count INT;
  total_cas INT;
BEGIN
  SELECT COUNT(*) INTO attack_count 
  FROM "DialogueMove" 
  WHERE kind = 'ATTACK';
  
  SELECT COUNT(*) INTO linked_count 
  FROM "ConflictApplication" 
  WHERE "createdByMoveId" IS NOT NULL;
  
  SELECT COUNT(*) INTO total_cas 
  FROM "ConflictApplication";
  
  RAISE NOTICE '=== Backfill ATTACK Moves Complete ===';
  RAISE NOTICE 'Total ATTACK moves in database: %', attack_count;
  RAISE NOTICE 'ConflictApplications with dialogue provenance: % / % (%.2f%%)', 
    linked_count, total_cas, (linked_count::float / NULLIF(total_cas, 0) * 100);
END $$;

-- Verification query: Check linkage quality
SELECT 
  'ATTACK Moves' AS metric,
  COUNT(*) AS count
FROM "DialogueMove"
WHERE kind = 'ATTACK'
UNION ALL
SELECT 
  'ConflictApplications Linked' AS metric,
  COUNT(*) AS count
FROM "ConflictApplication"
WHERE "createdByMoveId" IS NOT NULL
UNION ALL
SELECT 
  'ConflictApplications Unlinked' AS metric,
  COUNT(*) AS count
FROM "ConflictApplication"
WHERE "createdByMoveId" IS NULL;
