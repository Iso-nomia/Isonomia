-- Extend notifications for prediction markets
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TRADE_EXECUTED';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'MARKET_RESOLVED';

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "market_id" TEXT;
ALTER TABLE "notifications" ADD CONSTRAINT IF NOT EXISTS "notifications_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "prediction_markets"("id") ON DELETE CASCADE;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "trade_id" TEXT;
ALTER TABLE "notifications" ADD CONSTRAINT IF NOT EXISTS "notifications_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "prediction_trades"("id") ON DELETE CASCADE;
