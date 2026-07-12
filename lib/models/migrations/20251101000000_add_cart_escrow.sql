CREATE TYPE "escrow_state" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'REFUNDED');

CREATE TABLE "cart" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "offer_id" BIGINT NOT NULL UNIQUE REFERENCES "offers"("id"),
  "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deadline" TIMESTAMPTZ NOT NULL
);

CREATE INDEX "idx_cart_user" ON "cart"("user_id");

CREATE TABLE "escrow" (
  "id" BIGSERIAL PRIMARY KEY,
  "cart_id" BIGINT NOT NULL UNIQUE REFERENCES "cart"("id"),
  "state" "escrow_state" NOT NULL DEFAULT 'PENDING',
  "tx_ref" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
