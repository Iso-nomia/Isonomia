-- Migration: CQ Multi-Layer System
-- Phase 1: Add new tables and columns for community-driven CQ responses
-- This migration is backward-compatible and preserves existing data

-- Step 1: Create new enums
CREATE TYPE "CQStatusEnum" AS ENUM ('OPEN', 'PENDING_REVIEW', 'PARTIALLY_SATISFIED', 'SATISFIED', 'DISPUTED');
CREATE TYPE "ResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'CANONICAL', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN');
CREATE TYPE "CQAction" AS ENUM ('RESPONSE_SUBMITTED', 'RESPONSE_APPROVED', 'RESPONSE_REJECTED', 'RESPONSE_WITHDRAWN', 'STATUS_CHANGED', 'CANONICAL_SELECTED', 'ENDORSEMENT_ADDED', 'CLARIFICATION_REQUESTED');

-- Step 2: Add new columns to CQStatus (backward compatible)
ALTER TABLE "CQStatus" ADD COLUMN "statusEnum" "CQStatusEnum" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "CQStatus" ADD COLUMN "canonicalResponseId" TEXT;
ALTER TABLE "CQStatus" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "CQStatus" ADD COLUMN "lastReviewedBy" TEXT;

-- Step 3: Create CQResponse table
CREATE TABLE "CQResponse" (
    "id" TEXT NOT NULL,
    "cqStatusId" TEXT NOT NULL,
    "groundsText" TEXT NOT NULL,
    "evidenceClaimIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseStatus" "ResponseStatus" NOT NULL DEFAULT 'PENDING',
    "contributorId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "canonicalMoveId" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CQResponse_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create CQEndorsement table
CREATE TABLE "CQEndorsement" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CQEndorsement_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create CQActivityLog table
CREATE TABLE "CQActivityLog" (
    "id" TEXT NOT NULL,
    "cqStatusId" TEXT NOT NULL,
    "action" "CQAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "responseId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CQActivityLog_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create indexes for CQResponse
CREATE INDEX "CQResponse_cqStatusId_responseStatus_idx" ON "CQResponse"("cqStatusId", "responseStatus");
CREATE INDEX "CQResponse_contributorId_idx" ON "CQResponse"("contributorId");
CREATE INDEX "CQResponse_responseStatus_createdAt_idx" ON "CQResponse"("responseStatus", "createdAt");

-- Step 7: Create indexes for CQEndorsement
CREATE UNIQUE INDEX "CQEndorsement_responseId_userId_key" ON "CQEndorsement"("responseId", "userId");
CREATE INDEX "CQEndorsement_responseId_idx" ON "CQEndorsement"("responseId");
CREATE INDEX "CQEndorsement_userId_idx" ON "CQEndorsement"("userId");

-- Step 8: Create indexes for CQActivityLog
CREATE INDEX "CQActivityLog_cqStatusId_createdAt_idx" ON "CQActivityLog"("cqStatusId", "createdAt");
CREATE INDEX "CQActivityLog_actorId_idx" ON "CQActivityLog"("actorId");
CREATE INDEX "CQActivityLog_action_createdAt_idx" ON "CQActivityLog"("action", "createdAt");

-- Step 9: Create index for CQStatus new statusEnum
CREATE INDEX "CQStatus_statusEnum_roomId_idx" ON "CQStatus"("statusEnum", "roomId");

-- Step 10: Add foreign key constraints
ALTER TABLE "CQStatus" ADD CONSTRAINT "CQStatus_canonicalResponseId_fkey" FOREIGN KEY ("canonicalResponseId") REFERENCES "CQResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CQResponse" ADD CONSTRAINT "CQResponse_cqStatusId_fkey" FOREIGN KEY ("cqStatusId") REFERENCES "CQStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CQEndorsement" ADD CONSTRAINT "CQEndorsement_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "CQResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CQActivityLog" ADD CONSTRAINT "CQActivityLog_cqStatusId_fkey" FOREIGN KEY ("cqStatusId") REFERENCES "CQStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CQActivityLog" ADD CONSTRAINT "CQActivityLog_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "CQResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 11: Migrate existing data (see backfill script for details)
-- This is handled by the separate backfill-cq-responses.ts script
-- to avoid blocking the migration on large datasets

COMMENT ON COLUMN "CQStatus"."status" IS 'DEPRECATED: Use statusEnum instead';
COMMENT ON COLUMN "CQStatus"."satisfied" IS 'DEPRECATED: Check statusEnum = SATISFIED instead';
COMMENT ON COLUMN "CQStatus"."groundsText" IS 'DEPRECATED: Use responses relation instead';
