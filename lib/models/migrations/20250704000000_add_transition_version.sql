ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "version" INT;

-- backfill existing rows using the to_state version if available
UPDATE "workflow_transitions" wt
SET "version" = ws.version
FROM "workflow_states" ws
WHERE wt."to_state_id" = ws."id" AND wt."version" IS NULL;
