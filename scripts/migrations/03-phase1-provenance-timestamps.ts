/**
 * Q-022 + Q-024 Phase 1 — provenance and chronological auditing.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md §Phase 1
 *
 * What this migration does:
 *   - Adds a CHECK constraint enforcing `sourceCatalogue` enum {AIF, AIFdb,
 *     Argdown, WRM-2008, admin-authored}. Prisma cannot natively express this.
 *   - Verifies that the schema-level defaults populated provenance and
 *     timestamps on every existing row (Prisma db push sets defaults at the
 *     ALTER TABLE moment for newly-added NOT NULL columns).
 *   - Documents the limit: pre-Q024 `createdAt` values reflect the migration
 *     moment, not the actual creation date. `updatedAt` is meaningful from
 *     migration forward. `createdBy` is NULL for pre-migration rows.
 *
 * Idempotent: safe to re-run.
 */

import { prisma } from "@/lib/prismaclient";

const ALLOWED_SOURCE_CATALOGUES = [
  "AIF",
  "AIFdb",
  "Argdown",
  "WRM-2008",
  "admin-authored",
] as const;

const CHECK_CONSTRAINT_NAME = "ArgumentScheme_sourceCatalogue_check";

async function step1_addSourceCatalogueCheck(): Promise<void> {
  console.log("\n[step1] enforce CHECK constraint on sourceCatalogue");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ArgumentScheme" DROP CONSTRAINT IF EXISTS "${CHECK_CONSTRAINT_NAME}"`,
  );
  const allowed = ALLOWED_SOURCE_CATALOGUES.map((t) => `'${t}'`).join(", ");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ArgumentScheme" ADD CONSTRAINT "${CHECK_CONSTRAINT_NAME}" ` +
      `CHECK ("sourceCatalogue" IN (${allowed}))`,
  );
  console.log(`  CHECK enforces sourceCatalogue IN (${allowed})`);
}

async function step2_verifyBackfill(): Promise<void> {
  console.log("\n[step2] verify schema-default backfill on existing rows");
  // Prisma db push set sourceCatalogue='admin-authored' (column default) and
  // createdAt=now() (default) for all pre-existing rows when the columns were
  // added. updatedAt should equal createdAt at this point.
  const nullSource = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n FROM "ArgumentScheme" WHERE "sourceCatalogue" IS NULL`,
  );
  console.log(`  rows with NULL sourceCatalogue: ${Number(nullSource[0].n)} (expect 0)`);

  const distinct = await prisma.$queryRawUnsafe<
    { sourceCatalogue: string; n: bigint }[]
  >(
    `SELECT "sourceCatalogue", COUNT(*)::bigint AS n FROM "ArgumentScheme" GROUP BY "sourceCatalogue" ORDER BY n DESC`,
  );
  console.log("  sourceCatalogue distribution:");
  console.table(distinct.map((d) => ({ sourceCatalogue: d.sourceCatalogue, n: Number(d.n) })));

  const nullCreatedAt = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n FROM "ArgumentScheme" WHERE "createdAt" IS NULL`,
  );
  console.log(`  rows with NULL createdAt: ${Number(nullCreatedAt[0].n)} (expect 0)`);

  const sampled = await prisma.$queryRawUnsafe<
    { key: string; sourceCatalogue: string; createdAt: Date; createdBy: string | null }[]
  >(
    `SELECT key, "sourceCatalogue", "createdAt", "createdBy" FROM "ArgumentScheme" ORDER BY key LIMIT 5`,
  );
  console.log("  sample rows:");
  console.table(sampled);
}

async function step3_verifyProvenanceRecoverable(): Promise<void> {
  console.log("\n[step3] exit-criterion check (Q-022): provenance recoverable in O(1)");
  const total = await prisma.argumentScheme.count();
  const recoverable = await prisma.argumentScheme.count({
    where: { sourceCatalogue: { in: ALLOWED_SOURCE_CATALOGUES as readonly string[] as string[] } },
  });
  console.log(`  ${recoverable} / ${total} rows have a recognised sourceCatalogue (expect ${total}/${total})`);
}

async function main(): Promise<void> {
  console.log("=== Q-022 + Q-024 Phase 1 — provenance & timestamps ===");
  await step1_addSourceCatalogueCheck();
  await step2_verifyBackfill();
  await step3_verifyProvenanceRecoverable();
  await prisma.$disconnect();
  console.log("\n=== done ===");
}

main().catch(async (e) => {
  console.error("[phase1] failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
