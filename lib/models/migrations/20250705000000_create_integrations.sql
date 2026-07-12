CREATE TABLE IF NOT EXISTS "integrations" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL,
  "service" TEXT NOT NULL,
  "credential" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "integrations_user_service_unique" UNIQUE ("user_id", "service")
);

CREATE INDEX IF NOT EXISTS "integrations_user_id_idx" ON "integrations"("user_id");
