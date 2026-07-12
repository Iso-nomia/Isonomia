CREATE OR REPLACE FUNCTION public.notify_user_attributes_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- broadcast the user_id that changed
  PERFORM pg_notify('user_attributes_updated', NEW.user_id::text);
  RETURN NEW;
END;
$$;