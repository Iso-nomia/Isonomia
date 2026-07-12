-- 20250720_drop_auth_fks.sql
--------------------------------------------------
ALTER TABLE scroll_events
  DROP CONSTRAINT IF EXISTS scroll_events_user_id_fkey;

-- If you still want a FK to *public.users* add it back
-- ALTER TABLE scroll_events
--   ADD CONSTRAINT scroll_events_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES public.users(id)
--     ON DELETE CASCADE ON UPDATE CASCADE;

/* repeat for every table that still points at auth.users */
