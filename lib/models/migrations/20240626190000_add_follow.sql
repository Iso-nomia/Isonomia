CREATE TABLE IF NOT EXISTS "follows" (
  "id" BIGSERIAL PRIMARY KEY,
  "follower_id" BIGINT NOT NULL,
  "following_id" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follower_id_following_id" UNIQUE ("follower_id", "following_id"),
  CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE
);
