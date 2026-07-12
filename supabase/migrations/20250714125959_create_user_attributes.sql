CREATE TABLE IF NOT EXISTS public.user_attributes (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
