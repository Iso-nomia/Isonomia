/**
 * scripts/backfill-dm-locus-from-aif.ts
 *
 * Backfill `DialogueMove.locusId` for DMs that have no Ludics locus binding
 * but ARE referenced by an AifNode whose `ludicAct` does carry a locus.
 *
 * Why
 * ───
 * Many legacy deliberations populate the argument-graph world (Argument,
 * ArgumentPremise, DialogueMove.payload.argumentId) and the Ludics world
 * (LudicAct, LudicLocus) independently, with the two seams joined only via
 * AifNode (which has FKs to BOTH DialogueMove and LudicAct). The result:
 * `DialogueMove.locusId` is null for the majority of DMs, even though the
 * locus is implicitly known via the AifNode bridge.
 *
 * This script closes that gap with a single FK walk:
 *
 *   DialogueMove ←(AifNode.dialogueMoveId)→ AifNode ─(AifNode.ludicActId)→
 *   LudicAct ─(LudicAct.locusId)→ LudicLocus
 *
 * After this runs, the substrate bridge's Step 8.6 (DM →
 * payload.argumentId → ArgumentPremise.claimId, attributed to designs via
 * locus owners) can actually attribute premises to substrate Designs.
 *
 * Safety
 * ──────
 *   • Only touches DMs where `locusId IS NULL` AND
 *     `payload.locusPath` is NOT a non-empty string. Existing locus
 *     bindings are never overwritten.
 *   • Skips AifNode rows whose `ludicAct.locusId` is null (nothing to copy).
 *   • Idempotent: re-running is a no-op once all eligible DMs are filled.
 *   • Reversible: re-run with `--unset` to clear `locusId` back to null
 *     ONLY for DMs whose current `locusId` was placed by this script's
 *     forward pass (matched again by the same AifNode walk). Existing
 *     bindings placed by other code paths are left alone.
 *
 * Usage
 * ─────
 *   npx tsx scripts/backfill-dm-locus-from-aif.ts --deliberation-id <id>
 *   npx tsx scripts/backfill-dm-locus-from-aif.ts --deliberation-id <id> --dry-run
 *   npx tsx scripts/backfill-dm-locus-from-aif.ts --deliberation-id <id> --unset
 */

import { prisma } from "@/lib/prismaclient";

interface CliArgs {
  deliberationId: string;
  dryRun: boolean;
  unset: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let deliberationId: string | null = null;
  let dryRun = false;
  let unset = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--deliberation-id") {
      deliberationId = argv[++i] ?? null;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--unset") {
      unset = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  if (!deliberationId) {
    throw new Error(
      "Missing --deliberation-id <id>. Example:\n" +
        "  npx tsx scripts/backfill-dm-locus-from-aif.ts --deliberation-id cmoxol76e03748cssx07tvkhd",
    );
  }
  return { deliberationId, dryRun, unset };
}

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 70 - title.length))}`);
}

async function main(): Promise<void> {
  const { deliberationId, dryRun, unset } = parseArgs();

  console.log("=".repeat(72));
  console.log(`backfill-dm-locus-from-aif`);
  console.log(`  deliberationId: ${deliberationId}`);
  console.log(`  mode          : ${unset ? "UNSET" : "FORWARD"}${dryRun ? " (dry run)" : ""}`);
  console.log("=".repeat(72));

  // 1. Pull every AifNode in the deliberation that bridges DM ↔ LudicAct
  //    AND whose act actually has a locus we can copy.
  section("Step 1 — Walk AifNode (DM ↔ LudicAct) seam");
  const aifBridges = await prisma.aifNode.findMany({
    where: {
      deliberationId,
      dialogueMoveId: { not: null },
      ludicActId: { not: null },
    },
    select: {
      id: true,
      dialogueMoveId: true,
      ludicAct: { select: { locusId: true } },
    },
  });
  log(`AifNodes with DM ↔ LudicAct bridge: ${aifBridges.length}`);

  /** dmId → candidate locusId from the AIF walk. */
  const candidateLocusByDmId = new Map<string, string>();
  let aifNoActLocus = 0;
  for (const n of aifBridges) {
    const dmId = n.dialogueMoveId;
    const locusId = n.ludicAct?.locusId ?? null;
    if (!dmId) continue;
    if (!locusId) {
      aifNoActLocus++;
      continue;
    }
    // If multiple AIF bridges point at the same DM with different loci,
    // keep the first deterministically (sorted by AifNode.id below).
    if (!candidateLocusByDmId.has(dmId)) {
      candidateLocusByDmId.set(dmId, locusId);
    }
  }
  log(`AIF bridges whose act has no locus (skipped): ${aifNoActLocus}`);
  log(`Distinct DMs reachable from a locus via AIF: ${candidateLocusByDmId.size}`);

  if (candidateLocusByDmId.size === 0) {
    console.log("\nNothing to do.");
    return;
  }

  // 2. Pull the DMs we might touch, with their current binding state.
  section("Step 2 — Inspect current DialogueMove.locusId state");
  const dmIds = [...candidateLocusByDmId.keys()];
  const dms = await prisma.dialogueMove.findMany({
    where: { id: { in: dmIds }, deliberationId },
    select: { id: true, locusId: true, payload: true },
  });
  log(`DialogueMoves matched: ${dms.length} / ${dmIds.length}`);

  // Classify.
  let alreadyBound = 0;
  let payloadHasLocusPath = 0;
  let mismatchSkipped = 0;
  const toUpdate: Array<{ id: string; from: string | null; to: string }> = [];
  const toUnset: Array<{ id: string; from: string }> = [];

  for (const dm of dms) {
    const candidate = candidateLocusByDmId.get(dm.id);
    if (!candidate) continue;
    const payload = (dm.payload ?? null) as { locusPath?: unknown } | null;
    const payloadLocusPath =
      typeof payload?.locusPath === "string" && payload.locusPath.length > 0
        ? payload.locusPath
        : null;

    if (unset) {
      // Reverse: clear only if current locusId matches what we would
      // have set, and payload doesn't independently declare a locus.
      if (dm.locusId === candidate && !payloadLocusPath) {
        toUnset.push({ id: dm.id, from: dm.locusId });
      }
      continue;
    }

    // Forward.
    if (payloadLocusPath) {
      payloadHasLocusPath++;
      continue;
    }
    if (dm.locusId === candidate) {
      alreadyBound++;
      continue;
    }
    if (dm.locusId && dm.locusId !== candidate) {
      mismatchSkipped++;
      continue;
    }
    toUpdate.push({ id: dm.id, from: dm.locusId, to: candidate });
  }

  if (unset) {
    log(`DMs to clear: ${toUnset.length}`);
  } else {
    log(`already correctly bound          : ${alreadyBound}`);
    log(`payload.locusPath set (skipped)  : ${payloadHasLocusPath}`);
    log(`bound to a different locus (skip): ${mismatchSkipped}`);
    log(`to update                        : ${toUpdate.length}`);
  }

  // 3. Apply.
  section("Step 3 — Apply");
  if (unset) {
    if (dryRun) {
      for (const u of toUnset.slice(0, 5)) {
        log(`would clear DialogueMove(${u.id}).locusId (was ${u.from})`);
      }
      if (toUnset.length > 5) log(`... and ${toUnset.length - 5} more`);
    } else {
      let n = 0;
      for (const u of toUnset) {
        await prisma.dialogueMove.update({
          where: { id: u.id },
          data: { locusId: null },
        });
        n++;
      }
      log(`cleared: ${n}`);
    }
  } else {
    if (dryRun) {
      for (const u of toUpdate.slice(0, 5)) {
        log(`would set DialogueMove(${u.id}).locusId = ${u.to}`);
      }
      if (toUpdate.length > 5) log(`... and ${toUpdate.length - 5} more`);
    } else {
      let n = 0;
      for (const u of toUpdate) {
        await prisma.dialogueMove.update({
          where: { id: u.id },
          data: { locusId: u.to },
        });
        n++;
      }
      log(`updated: ${n}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Done.${dryRun ? "  (dry run — no writes)" : ""}`);
  console.log("=".repeat(72));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
