CREATE SCHEMA IF NOT EXISTS edge_logs;
CREATE TABLE IF NOT EXISTS edge_logs.external_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
