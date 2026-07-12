
-- 1. Drop any FK that still points at auth.users
ALTER TABLE scroll_events
  DROP CONSTRAINT IF EXISTS scroll_events_user_id_fkey;

-- 2. Re-add it pointing to public.users
ALTER TABLE scroll_events
  ADD CONSTRAINT scroll_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
      
/* repeat DROP + ADD for any other tables that were still referencing
   auth.users (if you have none left, step 2 can be omitted) */