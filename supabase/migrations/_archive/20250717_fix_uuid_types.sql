-- ========= M I G R A T I O N  F I X =========
CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Taste vectors
CREATE TABLE IF NOT EXISTS user_taste_vectors (
  user_id     UUID PRIMARY KEY,
  taste       VECTOR(256)  NOT NULL,
  traits      JSONB        DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_taste_vectors_ann
  ON user_taste_vectors
  USING ivfflat (taste vector_cosine_ops) WITH (lists = 100);

-- 2. Scroll events
CREATE TABLE IF NOT EXISTS scroll_events (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         NOT NULL,
  dwell_ms    INT          NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scroll_events_user_idx ON scroll_events (user_id);

-- 3. Materialised view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_dwell_avg AS
SELECT user_id, AVG(dwell_ms) AS avg_dwell_ms
FROM scroll_events
GROUP BY user_id;

-- 4. Refresh every 5 min
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh_user_dwell_avg'
  ) THEN
    PERFORM cron.schedule(
      'refresh_user_dwell_avg',
      '*/5 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY user_dwell_avg'
    );
  END IF;
END
$$;
