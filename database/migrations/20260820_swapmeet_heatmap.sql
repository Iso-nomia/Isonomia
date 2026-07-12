-- Add visitors column for heatmap tracking
ALTER TABLE section ADD COLUMN IF NOT EXISTS visitors INT DEFAULT 0;
