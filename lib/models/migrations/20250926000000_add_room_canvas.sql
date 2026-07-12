ALTER TYPE "realtime_post_type" ADD VALUE IF NOT EXISTS 'ROOM_CANVAS';
ALTER TABLE "realtime_posts" ADD COLUMN IF NOT EXISTS "room_post_content" JSONB;
