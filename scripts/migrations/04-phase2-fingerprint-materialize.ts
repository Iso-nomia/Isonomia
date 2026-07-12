/**
 * Spec 4 phase 4a — Phase 2 step 9: materialize behaviour fingerprints.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md
 *
 * Why this exists:
 *   Step 8 (and its extended sweep) confirmed there are zero behaviourally-equal
 *   pairs in the catalogue under the verifier's soundness contract. To make that
 *   invariant durable rather than a one-time audit, this migration:
 *     1. Materializes `ArgumentScheme.fingerprint` by running
 *        `computeBehaviourFingerprint` over every `kind='argument-scheme'` row.
 *        Dialogue-meta rows are left NULL — they have no CQs and trivially
 *        collide on the empty digest; they are excluded from the invariant
 *        and slated for removal in Phase 0.5.
 *     2. Creates a Postgres PARTIAL unique index
 *        `ArgumentScheme_argument_scheme_fingerprint_unique` scoped to
 *        `kind='argument-scheme'`. Partial indexes are not expressible in the
 *        Prisma schema DSL, so we manage them here.
 *     3. Verifies the invariant in code after backfill.
 *
 *  Idempotent: re-runs are safe; the index is dropped and recreated, and
 *  fingerprint writes are no-ops when the value is already correct.
 */

import { prisma } from "@/lib/prismaclient";
import {
  computeBehaviourFingerprint,
  type SchemeWithCqs,
} from "@/lib/schemes/verifier";

type Row = SchemeWithCqs & { kind: string; fingerprint: string | null };

const PARTIAL_INDEX_NAME = "ArgumentScheme_argument_scheme_fingerprint_unique";

async function main(): Promise<void> {
  console.log("=== Phase 2 step 9 — materialize behaviour fingerprints ===");

  // 0) Drop the partial unique index if it exists so backfill can rewrite values
  //    without spurious constraint failures on intermediate states.
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${PARTIAL_INDEX_NAME}"`);
  console.log(`[step0] dropped partial index (if any): ${PARTIAL_INDEX_NAME}`);

  const rows = (await prisma.argumentScheme.findMany({
    include: { cqs: true },
    orderBy: { key: "asc" },
  })) as unknown as Row[];
  console.log(`loaded ${rows.length} ArgumentScheme row(s)`);

  // 1) Compute + write fingerprints (kind='argument-scheme' only).
  let updated = 0;
  let unchanged = 0;
  let skippedNonArg = 0;
  const argSchemeFps = new Map<string, string[]>(); // fingerprint → keys
  for (const r of rows) {
    if (r.kind !== "argument-scheme") {
      skippedNonArg += 1;
      continue;
    }
    const fp = computeBehaviourFingerprint(r as any);
    if (r.fingerprint === fp) {
      unchanged += 1;
    } else {
      await prisma.argumentScheme.update({
        where: { id: r.id },
        data: { fingerprint: fp } as any,
      });
      updated += 1;
    }
    if (!argSchemeFps.has(fp)) argSchemeFps.set(fp, []);
    argSchemeFps.get(fp)!.push(r.key);
  }
  console.log(
    `[step1] fingerprints: updated=${updated} unchanged=${unchanged} skipped(non-arg)=${skippedNonArg}`,
  );

  // 2) Verify the duplicate-prevention invariant in code before promoting it
  //    to a DB constraint.
  const collisions = [...argSchemeFps.entries()].filter(([, keys]) => keys.length > 1);
  if (collisions.length > 0) {
    console.error("[step2] FAIL — fingerprint collisions within kind='argument-scheme':");
    for (const [fp, keys] of collisions) {
      console.error(`  ${fp.slice(0, 16)}…  ${keys.join(", ")}`);
    }
    throw new Error(
      `fingerprint collisions detected (${collisions.length}); resolve via retire-or-merge before the partial unique index can be installed`,
    );
  }
  console.log(
    `[step2] invariant holds — ${argSchemeFps.size} unique fingerprint(s) across ${updated + unchanged} argument-scheme rows`,
  );

  // 3) Create the Postgres PARTIAL unique index.
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "${PARTIAL_INDEX_NAME}"
     ON "ArgumentScheme" ("fingerprint")
     WHERE "kind" = 'argument-scheme'`,
  );
  console.log(`[step3] created partial unique index: ${PARTIAL_INDEX_NAME}`);

  // NOTE: we deliberately do NOT add a CHECK ("kind" <> 'argument-scheme' OR
  // "fingerprint" IS NOT NULL). Postgres CHECK constraints cannot be DEFERRED,
  // so they would fire on the initial INSERT in `create-then-add-CQs` flows
  // (which the row body alone cannot fingerprint until CQs are persisted). We
  // instead rely on:
  //   (a) the partial unique index above, which blocks any *populated*
  //       duplicate fingerprint;
  //   (b) production write paths (app/api/schemes/route.ts +
  //       app/api/schemes/[id]/route.ts) calling
  //       lib/schemes/persistence/recomputeSchemeFingerprint.ts after CQ
  //       writes;
  //   (c) the Jest invariant test
  //       __tests__/lib/schemes/fingerprint-invariant.test.ts which fails
  //       CI if any argument-scheme row has NULL fingerprint or any two
  //       collide.
  // Re-running this migration is safe and reasserts the invariant.

  // 4) Sanity check: nulls in argument-scheme rows.
  const nullArgCount = await prisma.argumentScheme.count({
    where: { kind: "argument-scheme", fingerprint: null } as any,
  });
  console.log(
    `[step4] kind='argument-scheme' rows with NULL fingerprint: ${nullArgCount} (target: 0)`,
  );
  if (nullArgCount > 0) {
    throw new Error("at least one argument-scheme row still has NULL fingerprint");
  }

  // 5) Echo the index definition so ops/devs see what's enforcing this in PG.
  const indexRows = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname='public' AND tablename='ArgumentScheme'
       AND indexname = '${PARTIAL_INDEX_NAME}'`,
  );
  console.log("[step5] enforcing index:");
  for (const i of indexRows) console.log(`  ${i.indexname}: ${i.indexdef}`);

  await prisma.$disconnect();
  console.log("=== done ===");
}

main().catch(async (e) => {
  console.error("[step9-fingerprint] failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});

