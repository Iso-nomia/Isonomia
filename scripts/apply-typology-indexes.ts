#!/usr/bin/env tsx
/**
 * Apply Typology / Meta-consensus (Scope B) partial unique indexes that
 * Prisma cannot express natively. Idempotent — uses
 * `CREATE UNIQUE INDEX IF NOT EXISTS`.
 *
 * Run after `npx prisma db push`.
 *
 * Usage: npx tsx scripts/apply-typology-indexes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "typology_candidate_seed_event_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS typology_candidate_seed_event_unique
      ON "TypologyCandidate" ((("seedReferenceJson"->>'facilitationEventId')))
      WHERE "seedReferenceJson" ? 'facilitationEventId'`,
  },
];

async function main() {
  for (const stmt of STATEMENTS) {
    process.stdout.write(`Applying ${stmt.name}... `);
    await prisma.$executeRawUnsafe(stmt.sql);
    console.log("OK");
  }
}

main()
  .catch((err) => {
    console.error("apply-typology-indexes: failed", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
