-- Phase D-1, Task 14 (Option A): collapse ClaimContrary.status enum from
-- {ACTIVE, PROPOSED, DISPUTED, RETRACTED} down to {ACTIVE, RETRACTED}.
--
-- The application has only ever written ACTIVE (on create) and RETRACTED
-- (on soft-delete); PROPOSED and DISPUTED were defined for a moderation
-- workflow that was never implemented. We coerce any leftover values to
-- ACTIVE so the simplified UI/API whitelist agrees with persisted data.
--
-- Run with: psql "$DATABASE_URL" -f prisma/migrations/contrary_status_collapse_to_active_retracted.sql
-- (No schema-level enum exists; status is a free-form String column.)

UPDATE "ClaimContrary"
SET    "status" = 'ACTIVE'
WHERE  "status" IN ('PROPOSED', 'DISPUTED');
