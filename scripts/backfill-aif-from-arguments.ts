/**
 * scripts/backfill-aif-from-arguments.ts
 *
 * One-shot backfill: for a given deliberation, walk every Argument row and
 * ensure the AIF graph (AifNode / AifEdge) contains the corresponding RA-node,
 * I-nodes, premise / conclusion / asserts edges, and DM-stub nodes.
 *
 * This closes the gap where AifNode + AifEdge are currently populated only for
 * the ~10% of DMs the legacy Ludics tab produced, leaving the bridge's
 * Step 8 (Design.premiseClaimIds) with nothing to walk.
 *
 * The actual per-argument work is delegated to
 * `services/aif/syncArgument.ts#syncArgumentToAif`, which is the same helper
 * the runtime ASSERT-DM path calls. That keeps backfill ↔ runtime in lockstep
 * and guarantees the script is a no-op on the second run.
 *
 * Usage
 * ─────
 *   npx tsx scripts/backfill-aif-from-arguments.ts --deliberation-id <id>
 *   npx tsx scripts/backfill-aif-from-arguments.ts --deliberation-id <id> --dry-run
 */

import { prisma } from "@/lib/prismaclient";
import {
  syncArgumentToAif,
  buildSyncArgumentCaches,
  type SyncArgumentResult,
} from "@/services/aif/syncArgument";

interface CliArgs {
  deliberationId: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let deliberationId: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--deliberation-id") deliberationId = argv[++i] ?? null;
    else if (a === "--dry-run") dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!deliberationId) {
    throw new Error(
      "Missing --deliberation-id <id>. Example:\n" +
        "  npx tsx scripts/backfill-aif-from-arguments.ts --deliberation-id cmoxol76e03748cssx07tvkhd",
    );
  }
  return { deliberationId, dryRun };
}

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(2, 72 - title.length - 4))}`);
}

async function main(): Promise<void> {
  const { deliberationId, dryRun } = parseArgs();
  console.log("=".repeat(72));
  console.log("Backfill AIF from Argument / ArgumentPremise / Claim");
  console.log("=".repeat(72));
  console.log(`Deliberation : ${deliberationId}`);
  console.log(`Mode         : ${dryRun ? "DRY RUN (no writes)" : "WRITE"}`);

  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!delib) throw new Error(`Deliberation ${deliberationId} not found.`);

  section("Step 1 — Enumerate Arguments");
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  log(`Arguments in deliberation: ${args.length}`);

  section("Step 1.5 — Pre-load AIF caches (5 bulk queries)");
  const cacheStart = Date.now();
  const caches = await buildSyncArgumentCaches(deliberationId);
  log(
    `RA nodes: ${caches.raByArgumentId.size}, I nodes: ${caches.iByClaimId.size}, ` +
      `DM stubs: ${caches.dmStubByMoveId.size}, edges: ${caches.edgeTriples.size}, ` +
      `DMs-with-argumentId: ${[...caches.dmsByArgumentId.values()].reduce((s, a) => s + a.length, 0)}`,
  );
  log(`Cache build: ${((Date.now() - cacheStart) / 1000).toFixed(1)}s`);

  section("Step 2 — Sync each Argument into AIF (idempotent)");

  // Roll-ups
  const totals = {
    raCreated: 0,
    raSkipped: 0,
    iCreated: 0,
    iSkipped: 0,
    edgesByRole: new Map<string, { created: number; skipped: number }>(),
    dmStubsCreated: 0,
    argumentsFailed: 0,
  };
  const bumpEdge = (role: string, created: number, skipped: number) => {
    const cur = totals.edgesByRole.get(role) ?? { created: 0, skipped: 0 };
    cur.created += created;
    cur.skipped += skipped;
    totals.edgesByRole.set(role, cur);
  };

  const startedAt = Date.now();
  let processed = 0;
  for (const a of args) {
    let r: SyncArgumentResult;
    try {
      r = await syncArgumentToAif({ argumentId: a.id, dryRun, caches });
    } catch (err: any) {
      totals.argumentsFailed++;
      log(`  ✗ ${a.id}: ${err?.message ?? err}`);
      processed++;
      continue;
    }
    if (r.raNodeCreated) totals.raCreated++;
    else totals.raSkipped++;
    totals.iCreated += r.iNodesCreated;
    totals.iSkipped += r.iNodesSkipped;
    bumpEdge("premise", r.premiseEdgesCreated, r.premiseEdgesSkipped);
    bumpEdge("conclusion", r.conclusionEdgesCreated, r.conclusionEdgesSkipped);
    bumpEdge("asserts", r.assertsEdgesCreated, r.assertsEdgesSkipped);
    totals.dmStubsCreated += r.dmStubsCreated;
    processed++;
    if (processed % 10 === 0 || processed === args.length) {
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      log(`  …${processed}/${args.length} (${secs}s)`);
    }
  }

  section("Step 3 — Summary");
  log(`RA AifNodes    : created ${totals.raCreated}, already-present ${totals.raSkipped}`);
  log(`I  AifNodes    : created ${totals.iCreated}, already-present ${totals.iSkipped}`);
  log(`DM stub nodes  : created ${totals.dmStubsCreated}`);
  for (const [role, cnt] of totals.edgesByRole.entries()) {
    log(`AifEdge[${role.padEnd(10)}]: created ${cnt.created}, already-present ${cnt.skipped}`);
  }
  if (totals.argumentsFailed > 0) {
    log(`Arguments failed: ${totals.argumentsFailed}`);
  }
  log(dryRun ? "Dry run complete — no writes." : "Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
