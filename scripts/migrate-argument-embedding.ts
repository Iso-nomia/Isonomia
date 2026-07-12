/**
 * AI-EPI C.1 — add embedding columns + HNSW index to "Argument".
 *
 * Run with: tsx scripts/migrate-argument-embedding.ts
 *
 * Idempotent. Uses DIRECT_URL via prisma's $executeRawUnsafe so it bypasses
 * the prisma schema-engine (which times out on this Supabase project for
 * the multi-column ALTER TABLE). Statements are issued one at a time so
 * each completes within the per-statement timeout.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Use DIRECT_URL (session-mode connection straight to the DB) so SET
// statement_timeout sticks for the lifetime of this script. The pooler
// connection (DATABASE_URL) is transaction-mode and resets session vars.
const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL is required for this migration script");
}
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
});

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "extension vector",
    sql: `CREATE EXTENSION IF NOT EXISTS vector`,
  },
  {
    label: "Argument.embedding",
    sql: `ALTER TABLE "Argument" ADD COLUMN IF NOT EXISTS "embedding" vector(1536)`,
  },
  {
    label: "Argument.embeddingHash",
    sql: `ALTER TABLE "Argument" ADD COLUMN IF NOT EXISTS "embeddingHash" text`,
  },
  {
    label: "Argument.embeddingModel",
    sql: `ALTER TABLE "Argument" ADD COLUMN IF NOT EXISTS "embeddingModel" text`,
  },
  {
    label: "Argument.embeddedAt",
    sql: `ALTER TABLE "Argument" ADD COLUMN IF NOT EXISTS "embeddedAt" timestamp(3)`,
  },
  {
    label: "HNSW index argument_embedding_hnsw",
    sql: `CREATE INDEX IF NOT EXISTS "argument_embedding_hnsw" ON "Argument" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
  },
];

async function main() {
  // Lift the per-statement timeout for the session — pooler defaults to a
  // few seconds which is too short for ALTER TABLE on a large hot table.
  await prisma.$executeRawUnsafe(`SET statement_timeout = '10min'`);
  await prisma.$executeRawUnsafe(`SET lock_timeout = '5min'`);
  for (const s of STATEMENTS) {
    process.stdout.write(`→ ${s.label} ... `);
    try {
      await prisma.$executeRawUnsafe(s.sql);
      console.log("ok");
    } catch (err: any) {
      console.log("FAIL");
      console.error(err?.message || err);
      throw err;
    }
  }
  console.log("\n✓ migration complete");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
