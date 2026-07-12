ALTER TABLE "feed_posts" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "realtime_posts" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "archived_realtime_posts" ADD COLUMN IF NOT EXISTS "caption" TEXT;
