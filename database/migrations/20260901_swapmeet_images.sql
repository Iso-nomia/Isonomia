-- Additional SwapMeet tables
CREATE TABLE IF NOT EXISTS stall_image (
  id SERIAL PRIMARY KEY,
  stall_id INT REFERENCES stall(id),
  url TEXT NOT NULL,
  blurhash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stall_section ON stall(owner_id, section_id);
