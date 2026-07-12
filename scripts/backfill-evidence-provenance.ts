/**
 * scripts/backfill-evidence-provenance.ts
 *
 * Track A.4 backfill: walks every ClaimEvidence row missing a
 * `contentSha256` and runs the provenance enrichment pipeline on it.
 *
 * Usage:
 *   npx tsx scripts/backfill-evidence-provenance.ts                # all missing
 *   npx tsx scripts/backfill-evidence-provenance.ts --limit 50     # cap
 *   npx tsx scripts/backfill-evidence-provenance.ts --force        # re-run rows that already have a hash
 *   npx tsx scripts/backfill-evidence-provenance.ts --no-archive   # skip archive.org snapshot request
 *   npx tsx scripts/backfill-evidence-provenance.ts --concurrency 4
 */

import { prisma } from "../lib/prismaclient";
import { enrichEvidenceProvenance } from "../lib/citations/evidenceProvenance";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "";
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const limit = Number(getArg("limit") ?? 0) || undefined;
  const force = hasFlag("force");
  const archive = !hasFlag("no-archive");
  const concurrency = Math.max(1, Math.min(8, Number(getArg("concurrency") ?? 3)));

  const where: any = force ? {} : { contentSha256: null };
  const rows = await prisma.claimEvidence.findMany({
    where,
    select: { id: true, uri: true },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(
    `Backfill: ${rows.length} ClaimEvidence row(s) to process ` +
      `(force=${force}, archive=${archive}, concurrency=${concurrency})`
  );

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  // Simple concurrency pool
  let cursor = 0;
  async function worker(workerIdx: number) {
    while (cursor < rows.length) {
      const idx = cursor++;
      const row = rows[idx];
      if (!row.uri) {
        skipped++;
        continue;
      }
      const result = await enrichEvidenceProvenance(row.id, { force, archive });
      if (!result) {
        skipped++;
      } else if (result.ok && result.contentSha256) {
        ok++;
        if ((idx + 1) % 10 === 0 || idx === rows.length - 1) {
          console.log(
            `  [${idx + 1}/${rows.length}] worker=${workerIdx} ok=${ok} fail=${failed} skip=${skipped}`
          );
        }
      } else {
        failed++;
        console.log(
          `  [${idx + 1}/${rows.length}] FAIL ${row.uri} \u2192 ${result.error ?? "unknown"}`
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, (_, i) => worker(i + 1))
  );

  console.log(`\nDone. ok=${ok} failed=${failed} skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
