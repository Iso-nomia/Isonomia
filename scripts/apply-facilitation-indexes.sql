-- Facilitation (Scope C / WS3) — post-`prisma db push` partial indexes.
--
-- Prisma cannot express partial unique indexes natively; this script applies
-- the ones documented in docs/facilitation/MIGRATION_DRAFT.md. Idempotent.
--
-- Apply with:
--   psql "$DATABASE_URL" -f scripts/apply-facilitation-indexes.sql

-- Locked decision #1: at most one OPEN session per deliberation.
CREATE UNIQUE INDEX IF NOT EXISTS facilitation_session_open_unique
  ON "FacilitationSession" ("deliberationId")
  WHERE status = 'OPEN';

-- Locked decision #3: at most one isFinal snapshot per (session, metricKind).
CREATE UNIQUE INDEX IF NOT EXISTS equity_metric_snapshot_final_unique
  ON "EquityMetricSnapshot" ("sessionId", "metricKind")
  WHERE "isFinal" = true;

-- At most one PENDING handoff originating from any one session.
CREATE UNIQUE INDEX IF NOT EXISTS facilitation_handoff_pending_unique
  ON "FacilitationHandoff" ("fromSessionId")
  WHERE status = 'PENDING';
