-- Add closedAt column to prediction_markets
ALTER TABLE prediction_markets
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
