-- supabase/migrations/20260510_swapmeet_stall.sql
CREATE TABLE IF NOT EXISTS stall (
  id          SERIAL PRIMARY KEY,
  section_id  INT REFERENCES section(id),
  seller_id   UUID REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
