-- ============================================================================
-- Diagnostic queries for dialogue provenance migration
-- Run these to understand why linkages didn't work
-- ============================================================================

-- 1. Check what kinds of DialogueMoves exist
SELECT 
  kind,
  COUNT(*) AS count,
  COUNT(DISTINCT "deliberationId") AS deliberations
FROM "DialogueMove"
GROUP BY kind
ORDER BY count DESC;

-- 2. Check GROUNDS moves specifically
SELECT 
  dm.id,
  dm."deliberationId",
  dm.kind,
  dm."argumentId",
  dm."actorId",
  dm."createdAt",
  CASE 
    WHEN dm."argumentId" IS NULL THEN 'No argumentId'
    WHEN EXISTS (SELECT 1 FROM "Argument" a WHERE a.id = dm."argumentId") THEN 'Argument exists'
    ELSE 'Argument missing'
  END AS argument_status
FROM "DialogueMove" dm
WHERE dm.kind = 'GROUNDS'
LIMIT 20;

-- 3. Check if Arguments have argumentId field that matches DialogueMove
SELECT 
  COUNT(*) AS grounds_moves_with_argumentId
FROM "DialogueMove"
WHERE kind = 'GROUNDS' AND "argumentId" IS NOT NULL;

-- 4. Check Arguments that should have been linked
SELECT 
  a.id,
  a."deliberationId",
  a."createdAt",
  a."createdByMoveId",
  (SELECT dm.id 
   FROM "DialogueMove" dm 
   WHERE dm."argumentId" = a.id 
   AND dm.kind = 'GROUNDS'
   LIMIT 1
  ) AS potential_grounds_move
FROM "Argument" a
LIMIT 20;

-- 5. Check DialogueMove schema - what fields exist?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'DialogueMove'
ORDER BY ordinal_position;

-- 6. Check if there's a different field name for argument reference
SELECT 
  dm.id,
  dm."deliberationId",
  dm.kind,
  dm."targetType",
  dm."targetId",
  dm."actorId"
FROM "DialogueMove" dm
WHERE dm.kind = 'GROUNDS'
LIMIT 5;

-- 7. Check ATTACK moves and their targets
SELECT 
  dm.id,
  dm."deliberationId",
  dm.kind,
  dm."targetType",
  dm."targetId",
  dm."actorId",
  dm."createdAt"
FROM "DialogueMove" dm
WHERE dm.kind = 'ATTACK'
LIMIT 20;

-- 8. Check ConflictApplications with ALL fields
SELECT 
  ca.id,
  ca."deliberationId",
  ca."createdById",
  ca."createdAt",
  ca."conflictingArgumentId",
  ca."conflictedArgumentId",
  ca."conflictingClaimId",
  ca."conflictedClaimId",
  ca."createdByMoveId"
FROM "ConflictApplication" ca
LIMIT 20;

-- 9. Check how many ConflictApplications use Claims vs Arguments
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "conflictingArgumentId" IS NOT NULL) AS has_conflicting_arg,
  COUNT(*) FILTER (WHERE "conflictedArgumentId" IS NOT NULL) AS has_conflicted_arg,
  COUNT(*) FILTER (WHERE "conflictingClaimId" IS NOT NULL) AS has_conflicting_claim,
  COUNT(*) FILTER (WHERE "conflictedClaimId" IS NOT NULL) AS has_conflicted_claim
FROM "ConflictApplication";

-- 10. Sample ATTACK moves with timing
SELECT 
  dm.id AS move_id,
  dm."deliberationId",
  dm."actorId",
  dm."createdAt" AS move_time,
  (
    SELECT COUNT(*)
    FROM "ConflictApplication" ca
    WHERE ca."deliberationId" = dm."deliberationId"
    AND ca."createdAt" BETWEEN (dm."createdAt" - INTERVAL '10 seconds') 
                           AND (dm."createdAt" + INTERVAL '10 seconds')
  ) AS nearby_conflicts_count
FROM "DialogueMove" dm
WHERE dm.kind = 'ATTACK'
LIMIT 10;

-- 11. Detailed view of ATTACK move → ConflictApplication matches
SELECT 
  dm.id AS move_id,
  dm."createdAt" AS move_time,
  ca.id AS conflict_id,
  ca."createdAt" AS conflict_time,
  EXTRACT(EPOCH FROM (ca."createdAt" - dm."createdAt")) AS time_diff_seconds,
  (ca."createdById" = dm."actorId") AS actor_match
FROM "DialogueMove" dm
LEFT JOIN "ConflictApplication" ca
  ON ca."deliberationId" = dm."deliberationId"
  AND ca."createdAt" BETWEEN (dm."createdAt" - INTERVAL '10 seconds') 
                         AND (dm."createdAt" + INTERVAL '10 seconds')
WHERE dm.kind = 'ATTACK'
ORDER BY dm."createdAt", time_diff_seconds
LIMIT 30;
