-- Additional tables for SwapMeet
CREATE TABLE IF NOT EXISTS offer (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES item(id),
  buyer_id BIGINT REFERENCES users(id),
  price_cents INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES item(id),
  stall_id INT REFERENCES stall(id),
  reserve_cents INT NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bid (
  id SERIAL PRIMARY KEY,
  auction_id INT REFERENCES auction(id),
  bidder_id BIGINT REFERENCES users(id),
  amount_cents INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "order" (
  id SERIAL PRIMARY KEY,
  stall_id INT REFERENCES stall(id),
  buyer_id BIGINT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_line (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES "order"(id),
  item_id INT REFERENCES item(id),
  quantity INT NOT NULL,
  price_cents INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
