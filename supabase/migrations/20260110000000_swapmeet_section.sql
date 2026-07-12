-- supabase/migrations/20250815_swapmeet_section.sql
CREATE TABLE IF NOT EXISTS section (
  id          BIGSERIAL PRIMARY KEY,
  x           INT  NOT NULL,
  y           INT  NOT NULL
);
-- unique index so each coord appears once
CREATE UNIQUE INDEX IF NOT EXISTS idx_section_xy ON section (x, y);