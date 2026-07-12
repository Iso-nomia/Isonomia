-- Typology / Meta-consensus (Scope B / WS2) — post-`prisma db push` partial indexes.
--
-- Prisma cannot express partial unique indexes on JSONB paths natively; this
-- script applies the ones documented in docs/typology/MIGRATION_DRAFT.md.
-- Idempotent (CREATE UNIQUE INDEX IF NOT EXISTS).
--
-- Apply with:
--   psql "$DATABASE_URL" -f scripts/apply-typology-indexes.sql
-- or
--   npx tsx scripts/apply-typology-indexes.ts

-- Decision #2 / handoff §2: a facilitation event MUST seed at most one
-- typology candidate. Replays of the same FacilitationEvent.id MUST find the
-- existing row instead of inserting a duplicate. Scoped to rows that actually
-- carry a `facilitationEventId` reference (other seed sources are exempt).
CREATE UNIQUE INDEX IF NOT EXISTS typology_candidate_seed_event_unique
  ON "TypologyCandidate" ((("seedReferenceJson"->>'facilitationEventId')))
  WHERE "seedReferenceJson" ? 'facilitationEventId';
