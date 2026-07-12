CREATE OR REPLACE FUNCTION lock_wallet(p_user_id BIGINT)
RETURNS BIGINT AS $$
  SELECT id FROM "VirtualWallet" WHERE "user_id" = p_user_id FOR UPDATE;
$$ LANGUAGE SQL;

CREATE INDEX trade_market_user_idx ON "Trade" ("marketId","userId");
