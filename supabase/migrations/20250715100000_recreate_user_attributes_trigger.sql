DO $$
BEGIN
  -- Drop the old one if it half-exists
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'user_attributes_notify'
      AND tgrelid = 'public.user_attributes'::regclass
  ) THEN
    DROP TRIGGER user_attributes_notify ON public.user_attributes;
  END IF;

  -- Recreate without column list
  CREATE TRIGGER user_attributes_notify
  AFTER UPDATE ON public.user_attributes
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_attributes_update();
END$$;
