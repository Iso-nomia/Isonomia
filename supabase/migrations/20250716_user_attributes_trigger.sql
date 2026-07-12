CREATE OR REPLACE FUNCTION notify_user_attributes_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('user_attributes_updated', NEW.user_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_attributes_notify ON user_attributes;
CREATE TRIGGER user_attributes_notify
AFTER UPDATE OF artists, albums, songs, interests, movies, communities, hobbies, location, books, birthday
ON user_attributes
FOR EACH ROW
EXECUTE FUNCTION notify_user_attributes_update();
