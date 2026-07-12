#!/usr/bin/env tsx
/**
 * Apply Facilitation (Scope C) partial unique indexes that Prisma cannot
 * express natively. Idempotent — uses `CREATE UNIQUE INDEX IF NOT EXISTS`.
 *
 * Run after `npx prisma db push`.
 *
 * Usage: npx tsx scripts/apply-facilitation-indexes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "facilitation_session_open_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS facilitation_session_open_unique
      ON "FacilitationSession" ("deliberationId")
      WHERE status = 'OPEN'`,
  },
  {
    name: "equity_metric_snapshot_final_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS equity_metric_snapshot_final_unique
      ON "EquityMetricSnapshot" ("sessionId", "metricKind")
      WHERE "isFinal" = true`,
  },
  {
    name: "facilitation_handoff_pending_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS facilitation_handoff_pending_unique
      ON "FacilitationHandoff" ("fromSessionId")
      WHERE status = 'PENDING'`,
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
    console.error("apply-facilitation-indexes: failed", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
