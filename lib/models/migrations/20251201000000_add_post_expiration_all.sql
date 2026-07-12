ALTER TABLE "feed_posts" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;
ALTER TABLE "realtime_posts" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;
ALTER TABLE "archived_realtime_posts" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;
