CREATE TABLE IF NOT EXISTS "archived_realtime_posts" (
  "id" BIGSERIAL PRIMARY KEY,
  "original_post_id" BIGINT UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL,
  "content" TEXT,
  "image_url" TEXT,
  "video_url" TEXT,
  "author_id" BIGINT NOT NULL,
  "updated_at" TIMESTAMPTZ,
  "like_count" INT DEFAULT 0,
  "x_coordinate" DECIMAL NOT NULL,
  "y_coordinate" DECIMAL NOT NULL,
  "type" realtime_post_type NOT NULL DEFAULT 'TEXT',
  "realtime_room_id" TEXT NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "collageLayoutStyle" TEXT,
  "collageColumns" INT,
  "collageGap" INT,
  "isPublic" BOOLEAN DEFAULT false,
  "pluginType" TEXT,
  "pluginData" JSONB,
  "parent_id" BIGINT,
  "archived_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archived_realtime_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "realtime_posts_created_at_idx" ON "realtime_posts"("created_at");
CREATE INDEX IF NOT EXISTS "realtime_posts_room_created_idx" ON "realtime_posts"("realtime_room_id", "created_at");
