ALTER TABLE stall ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_stall_owner_vis ON stall(owner_id, updated_at DESC);
