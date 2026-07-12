CREATE TABLE IF NOT EXISTS "rooms" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "is_sharded" boolean NOT NULL DEFAULT false,
  "shard_url" text,
  "media_bucket" text,
  "kms_key_arn" text
);

CREATE INDEX IF NOT EXISTS "rooms_is_sharded_idx" ON "rooms"("is_sharded");