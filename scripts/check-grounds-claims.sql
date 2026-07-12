-- Check GROUNDS move distribution
SELECT 
  "targetType",
  COUNT(*) AS count
FROM "DialogueMove"
WHERE kind = 'GROUNDS'
GROUP BY "targetType";

-- Check if targetType='claim' GROUNDS moves can be linked
SELECT 
  dm.id AS move_id,
  dm."targetId" AS claim_id,
  dm."targetType",
  a.id AS argument_id,
  a."conclusionClaimId"
FROM "DialogueMove" dm
LEFT JOIN "Argument" a ON a."conclusionClaimId" = dm."targetId"
WHERE dm.kind = 'GROUNDS'
AND dm."targetType" = 'claim'
LIMIT 10;
