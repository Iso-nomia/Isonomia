ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "archived_posts" (
  "id" BIGSERIAL PRIMARY KEY,
  "original_post_id" BIGINT UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL,
  "content" TEXT NOT NULL,
  "author_id" BIGINT NOT NULL,
  "updated_at" TIMESTAMPTZ,
  "parent_id" BIGINT,
  "like_count" INT DEFAULT 0,
  "expiration_date" TIMESTAMPTZ,
  "archived_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archived_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
