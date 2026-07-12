-- Fix ArgumentSupport Data Integrity Issue
-- This script creates ArgumentSupport records for arguments that lack them
-- Run this in Supabase SQL Editor

-- Step 1: Create ArgumentSupport records for arguments missing them
-- Link each argument to its claim with default confidence values
INSERT INTO "ArgumentSupport" (
  id,
  "argumentId",
  "claimId",
  "deliberationId",
  base,
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid() AS id,
  a.id AS "argumentId",
  a."claimId",
  a."deliberationId",
  0.7 AS base, -- Default base confidence (70%)
  a."createdAt",
  NOW() AS "updatedAt"
FROM "Argument" a
WHERE 
  -- Only arguments with a claim
  a."claimId" IS NOT NULL
  -- That don't already have an ArgumentSupport
  AND NOT EXISTS (
    SELECT 1 FROM "ArgumentSupport" s 
    WHERE s."argumentId" = a.id
  )
  -- Only in deliberations (not orphaned)
  AND a."deliberationId" IS NOT NULL;

-- Step 2: Report on what was fixed
SELECT 
  COUNT(*) AS "records_created",
  COUNT(DISTINCT "deliberationId") AS "deliberations_affected"
FROM "ArgumentSupport"
WHERE "updatedAt" > NOW() - INTERVAL '1 minute';

-- Step 3: Verify integrity
-- Show arguments that still lack supports (should be 0 or only those without claims)
SELECT 
  COUNT(*) AS "arguments_without_supports",
  COUNT(DISTINCT a."deliberationId") AS "deliberations_affected"
FROM "Argument" a
LEFT JOIN "ArgumentSupport" s ON s."argumentId" = a.id
WHERE 
  s.id IS NULL 
  AND a."claimId" IS NOT NULL
  AND a."deliberationId" IS NOT NULL;

-- Expected output: 0 arguments_without_supports

-- Step 4: Show summary statistics
SELECT 
  d.id AS "deliberation_id",
  d.title,
  COUNT(DISTINCT a.id) AS "total_arguments",
  COUNT(DISTINCT s.id) AS "total_supports",
  CASE 
    WHEN COUNT(DISTINCT a.id) = COUNT(DISTINCT s.id) THEN '✅ Complete'
    ELSE '⚠️ Missing supports'
  END AS status
FROM "Deliberation" d
LEFT JOIN "Argument" a ON a."deliberationId" = d.id AND a."claimId" IS NOT NULL
LEFT JOIN "ArgumentSupport" s ON s."argumentId" = a.id
WHERE d."agoraRoomId" IS NOT NULL -- Only deliberations with rooms
GROUP BY d.id, d.title
ORDER BY COUNT(DISTINCT a.id) DESC
LIMIT 20;
