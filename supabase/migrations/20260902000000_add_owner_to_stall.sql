ALTER TABLE stall
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- back‑fill
UPDATE stall SET owner_id = seller_id WHERE owner_id IS NULL;

-- create the index now that owner_id exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_stall_section
  ON stall(owner_id, section_id);
