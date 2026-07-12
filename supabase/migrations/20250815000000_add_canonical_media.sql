CREATE TABLE IF NOT EXISTS "canonical_media" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" DOUBLE PRECISION[],
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "favorite_items" (
  "user_id" BIGINT NOT NULL,
  "media_id" TEXT NOT NULL REFERENCES "canonical_media"("id"),
  "rating" INT,
  "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "media_id")
);

CREATE INDEX IF NOT EXISTS "favorite_items_user_id_idx" ON "favorite_items" ("user_id");
