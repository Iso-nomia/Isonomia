ALTER TYPE "realtime_post_type" ADD VALUE IF NOT EXISTS 'PREDICTION';

CREATE TABLE IF NOT EXISTS "prediction_markets" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  "postId" BIGINT UNIQUE NOT NULL,
  "question" VARCHAR(140) NOT NULL,
  "closesAt" TIMESTAMPTZ NOT NULL,
  "resolvesAt" TIMESTAMPTZ,
  "state" TEXT NOT NULL DEFAULT 'OPEN',
  "outcome" TEXT,
  "b" DOUBLE PRECISION NOT NULL,
  "yesPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "noPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "creatorId" BIGINT NOT NULL,
  "oracleId" BIGINT,
  CONSTRAINT "prediction_markets_postId_fkey" FOREIGN KEY ("postId") REFERENCES "realtime_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "prediction_markets_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "prediction_markets_oracleId_fkey" FOREIGN KEY ("oracleId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "prediction_trades" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  "marketId" TEXT NOT NULL REFERENCES "prediction_markets"("id") ON DELETE CASCADE,
  "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "side" TEXT NOT NULL,
  "shares" DOUBLE PRECISION NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "cost" INT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "realtime_posts" ADD COLUMN IF NOT EXISTS "predictionMarketId" TEXT;
ALTER TABLE "realtime_posts" ADD CONSTRAINT "realtime_posts_predictionMarketId_fkey" FOREIGN KEY ("predictionMarketId") REFERENCES "prediction_markets"("id");
