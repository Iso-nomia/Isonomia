CREATE TABLE IF NOT EXISTS "linked_accounts" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "provider")
);
CREATE INDEX IF NOT EXISTS "linked_accounts_user_id_idx" ON "linked_accounts"("user_id");
