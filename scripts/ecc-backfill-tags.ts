#!/usr/bin/env tsx
/**
 * Sprint B3 — ECC tag backfill.
 *
 * Walks every `ArgumentSupport` row (optionally filtered by deliberation)
 * and writes the structural + logical tags from `computeArrowTags` into
 * `metaJson.{simple,entire,selected,logical}`.
 *
 * Idempotent: safe to re-run; only the four tag keys are touched, all other
 * `metaJson` fields are preserved verbatim.
 *
 * Usage:
 *   npx tsx scripts/ecc-backfill-tags.ts                 # all rooms
 *   npx tsx scripts/ecc-backfill-tags.ts <deliberationId> # one room
 */

import { prisma } from "@/lib/prismaclient";
import { tagSupportsForArguments } from "@/lib/evidential/lazy-recompute";

async function main() {
  const deliberationId = process.argv[2];
  const where = deliberationId ? { deliberationId } : {};
  console.log(
    deliberationId
      ? `🏷️  ECC tag backfill — deliberation ${deliberationId}`
      : "🏷️  ECC tag backfill — all deliberations"
  );

  const distinctArgs = await prisma.argumentSupport.findMany({
    where,
    select: { argumentId: true },
    distinct: ["argumentId"],
  });
  const argumentIds = distinctArgs.map((r) => r.argumentId);
  console.log(`📊 ${argumentIds.length} distinct argumentIds to tag`);

  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < argumentIds.length; i += BATCH) {
    const batch = argumentIds.slice(i, i + BATCH);
    const n = await tagSupportsForArguments(batch);
    written += n;
    process.stdout.write(`  …tagged ${written} support rows\r`);
  }
  console.log(`\n✅ done. Wrote tags to ${written} ArgumentSupport rows.`);
}

main()
  .catch((err) => {
    console.error("❌ backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
