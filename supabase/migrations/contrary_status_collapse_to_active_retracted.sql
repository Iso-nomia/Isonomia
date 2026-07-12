-- Phase D-1, Task 14 (Option A): collapse ClaimContrary.status to {ACTIVE, RETRACTED}.
-- Paste this into the Supabase SQL editor and run.
--
-- Safe to run multiple times. Coerces any rows that were ever written with
-- PROPOSED or DISPUTED (legacy values that the UI never produced) into ACTIVE
-- so the simplified API whitelist agrees with persisted data. status is a
-- free-form text column, so no enum migration is required.

BEGIN;

UPDATE "ClaimContrary"
SET    "status" = 'ACTIVE'
WHERE  "status" IN ('PROPOSED', 'DISPUTED');

-- Sanity check: after this runs the only distinct values should be ACTIVE / RETRACTED.
-- SELECT "status", COUNT(*) FROM "ClaimContrary" GROUP BY "status";

COMMIT;
