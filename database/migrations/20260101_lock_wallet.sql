-- Adds wallet locking function and resolution log table
CREATE OR REPLACE FUNCTION lock_wallet(p_user_id bigint)
RETURNS void AS $$
BEGIN
  PERFORM 1 FROM wallet WHERE user_id = p_user_id FOR UPDATE;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS resolution_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL REFERENCES prediction_markets(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  amount INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_market ON resolution_log(market_id);
CREATE INDEX IF NOT EXISTS idx_resolution_user ON resolution_log(user_id);

CREATE TABLE IF NOT EXISTS wallet (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  balance_cents INT NOT NULL DEFAULT 0,
  locked_cents INT NOT NULL DEFAULT 0
);
