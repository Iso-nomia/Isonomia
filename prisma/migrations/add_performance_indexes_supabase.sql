-- Performance Optimization Indexes for Unified Arguments API
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Estimated time: 1-2 minutes for typical database sizes
-- Safe to run: Uses IF NOT EXISTS to avoid errors on re-runs

-- ============================================================================
-- ARGUMENT TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_argument_delib_created" 
  ON "Argument" ("deliberationId", "createdAt" DESC, "id");

CREATE INDEX IF NOT EXISTS "idx_argument_delib_conclusion" 
  ON "Argument" ("deliberationId", "conclusionClaimId") 
  WHERE "conclusionClaimId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_argument_scheme" 
  ON "Argument" ("schemeId") 
  WHERE "schemeId" IS NOT NULL;

-- ============================================================================
-- CONFLICT APPLICATION INDEXES (Attack Counting)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_conflict_app_arg" 
  ON "ConflictApplication" ("deliberationId", "conflictedArgumentId") 
  WHERE "conflictedArgumentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_conflict_app_claim" 
  ON "ConflictApplication" ("deliberationId", "conflictedClaimId") 
  WHERE "conflictedClaimId" IS NOT NULL;

-- ============================================================================
-- PREFERENCE APPLICATION INDEXES (ASPIC+ Preferences)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_pref_app_preferred" 
  ON "PreferenceApplication" ("preferredArgumentId") 
  WHERE "preferredArgumentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_pref_app_dispreferred" 
  ON "PreferenceApplication" ("dispreferredArgumentId") 
  WHERE "dispreferredArgumentId" IS NOT NULL;

-- ============================================================================
-- ARGUMENT SUPPORT INDEXES (Evidential System)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_arg_support_delib_claim" 
  ON "ArgumentSupport" ("deliberationId", "claimId");

CREATE INDEX IF NOT EXISTS "idx_arg_support_arg" 
  ON "ArgumentSupport" ("argumentId");

-- ============================================================================
-- ARGUMENT EDGE INDEXES (Premise Relationships)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_arg_edge_support" 
  ON "ArgumentEdge" ("deliberationId", "toArgumentId", "type") 
  WHERE "type" = 'support';

-- ============================================================================
-- NEGATION MAP INDEXES (DS Mode Conflict Detection)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_negation_map_delib_claim" 
  ON "NegationMap" ("deliberationId", "claimId");

-- ============================================================================
-- CRITICAL QUESTION STATUS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_cq_status_arg" 
  ON "CQStatus" ("argumentId", "cqKey", "status") 
  WHERE "argumentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_cq_status_target" 
  ON "CQStatus" ("targetType", "targetId", "cqKey", "status") 
  WHERE "targetType" = 'argument';

-- ============================================================================
-- DERIVATION ASSUMPTION INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_deriv_assumption_deriv" 
  ON "DerivationAssumption" ("derivationId");

-- ============================================================================
-- VERIFICATION: Check if indexes were created successfully
-- ============================================================================

SELECT 
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
ORDER BY relname, indexrelname;
