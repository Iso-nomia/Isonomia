/**
 * scripts/seed-ludics-showcase.ts
 *
 * Seeds the minimum viable Ludics data for smoke-testing all 14 Phase 1 MCP
 * tools against a real DB.  Targets the 143-argument deliberation that
 * underpins the `large-real-db` eval fixture.
 *
 * What it creates (idempotent — safe to re-run):
 *   • LudicMove  — one per argument (locus = ⊢A.{i}, moveType = "positive",
 *                  stratumLabel = "latent")
 *   • Behaviour  — one at the root locus ⊢A.0
 *   • Design x3  — multi-cone B (post-2e/2f generic case, |Inc(B)| ≥ 2):
 *       ─ cone_0 base       : derivedBy = null, loci = [⊢A.0, ⊢A.1, ⊢A.2]
 *       ─ cone_0 extension  : derivedBy = "extend", loci = [⊢A.0..⊢A.4]
 *                             (literal chronicle-set extension of the base —
 *                             preserves daimon skeleton per Daimon Lock Lemma)
 *       ─ cone_1 base       : derivedBy = null, loci = [⊢A.0, ⊢A.5, ⊢A.6]
 *                             (alternative incarnation, distinct branches —
 *                             cone-incompatible with cone_0 per Phase 2e)
 *   • DesignInclusion — base_0 ⊂ extension_0 (same-cone only; cross-cone
 *                       inclusions are semantically impossible and asserted
 *                       against before insertion)
 *   • WitnessRecord x3 — first three moves marked as stratumLabel = "walked"
 *
 * Usage:
 *   npx tsx scripts/seed-ludics-showcase.ts
 *   npx tsx scripts/seed-ludics-showcase.ts --deliberation-id <id>
 */

import { prisma } from "@/lib/prismaclient";

// ─── Configuration ────────────────────────────────────────────────────────────

// Default: the 143-argument deliberation from the large-real-db fixture
const DEFAULT_DELIBERATION_ID = "cmoxol76e03748cssx07tvkhd";

// Sentinel participant used for showcase WitnessRecords (not a real user)
const SHOWCASE_PARTICIPANT_ID = "seed-showcase-participant";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function locus(i: number): string {
  return `⊢A.${i}`;
}

function log(msg: string): void {
  console.log(`  ${msg}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedLudicsShowcase(deliberationId: string): Promise<void> {
  console.log("=".repeat(72));
  console.log("Ludics Showcase Seed — Phase 2a Step 3");
  console.log("=".repeat(72));
  console.log(`\nDeliberation: ${deliberationId}\n`);

  // ── 1. Verify deliberation exists and has ≥ 50 arguments ─────────────────

  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (args.length < 50) {
    throw new Error(
      `Deliberation ${deliberationId} has only ${args.length} arguments (need ≥ 50).`
    );
  }

  log(`Found ${args.length} arguments.`);

  // ── 2. Upsert LudicMove for each argument ────────────────────────────────
  //
  // Upsert by (deliberationId, locus) unique constraint so the script is
  // idempotent — re-running does not duplicate rows.

  log("Upserting LudicMove rows …");

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < args.length; i++) {
    const loc = locus(i);

    const existing = await prisma.ludicMove.findUnique({
      where: { deliberationId_locus: { deliberationId, locus: loc } },
      select: { id: true, argumentId: true },
    });

    if (existing) {
      // Backfill argumentId on legacy rows that were seeded before the column
      // was wired (P1.h.5). Idempotent: skips when already populated.
      if (existing.argumentId !== args[i].id) {
        await prisma.ludicMove.update({
          where: { id: existing.id },
          data: { argumentId: args[i].id },
        });
      }
      skipped++;
      continue;
    }

    await prisma.ludicMove.create({
      data: {
        deliberationId,
        locus: loc,
        moveType: "positive",
        stratumLabel: "latent",
        // B9 (P1.h.5): structural back-reference enabling fossilizeByArgument
        // to retract all witnesses for a deleted argument via an indexed
        // join rather than the legacy text-match fallback (now deleted).
        argumentId: args[i].id,
      },
    });
    created++;
  }

  log(`  → created ${created}, skipped ${skipped} (already existed)`);

  // ── 3. Fetch all moves ordered by locus index ─────────────────────────────

  const moves = await prisma.ludicMove.findMany({
    where: { deliberationId },
    orderBy: { locus: "asc" },
  });

  log(`Total moves in DB: ${moves.length}`);

  // ── 4. Upsert Behaviour at root locus ⊢A.0 ───────────────────────────────

  log("Upserting Behaviour at root locus ⊢A.0 …");

  const behaviour = await prisma.behaviour.upsert({
    where: { deliberationId_rootLocus: { deliberationId, rootLocus: locus(0) } },
    create: { deliberationId, rootLocus: locus(0) },
    update: {},
  });

  log(`  → behaviour.id = ${behaviour.id}`);

  // ── 5. Upsert three Design rows (multi-cone B, post-2e/2f generic case) ──
  //
  //   cone_0:
  //     baseCone0     — derivedBy = null,    loci = [⊢A.0, ⊢A.1, ⊢A.2]
  //     extensionCone0 — derivedBy = "extend", loci = [⊢A.0..⊢A.4]
  //                       (literal chronicle-set extension of baseCone0;
  //                        preserves daimon skeleton per Daimon Lock Lemma —
  //                        Phase 2f Reading A: union, closureSteps = 0)
  //   cone_1:
  //     baseCone1     — derivedBy = null,    loci = [⊢A.0, ⊢A.5, ⊢A.6]
  //                       (alternative incarnation; ⊃ neither cone_0 design.
  //                        Phase 2e: cones are antichain-decomposed, so
  //                        baseCone1 and the cone_0 designs are cross-cone.)

  const baseCone0Loci      = [locus(0), locus(1), locus(2)];
  const extensionCone0Loci = [locus(0), locus(1), locus(2), locus(3), locus(4)];
  const baseCone1Loci      = [locus(0), locus(5), locus(6)];

  const baseCone0PremiseIds      = args.slice(0, 3).map((a) => a.id);
  const extensionCone0PremiseIds = args.slice(0, 5).map((a) => a.id);
  const baseCone1PremiseIds      = [args[0].id, args[5].id, args[6].id];

  log("Upserting Design rows (cone_0 base + extension, cone_1 base) …");

  let designBaseCone0 = await prisma.design.findFirst({
    where: { behaviourId: behaviour.id, biorthoClass: "showcase-cone0-base" },
  });

  if (!designBaseCone0) {
    designBaseCone0 = await prisma.design.create({
      data: {
        behaviourId: behaviour.id,
        deliberationId,
        loci: baseCone0Loci,
        premiseClaimIds: baseCone0PremiseIds,
        biorthoClass: "showcase-cone0-base",
        derivedBy: null, // ← base of cone_0
      },
    });
    log(`  → created designBaseCone0.id = ${designBaseCone0.id}`);
  } else {
    log(`  → designBaseCone0 already exists: ${designBaseCone0.id}`);
  }

  let designExtensionCone0 = await prisma.design.findFirst({
    where: { behaviourId: behaviour.id, biorthoClass: "showcase-cone0-extension" },
  });

  if (!designExtensionCone0) {
    designExtensionCone0 = await prisma.design.create({
      data: {
        behaviourId: behaviour.id,
        deliberationId,
        loci: extensionCone0Loci,
        premiseClaimIds: extensionCone0PremiseIds,
        biorthoClass: "showcase-cone0-extension",
        derivedBy: "extend", // ← literal chronicle-set extension of baseCone0
      },
    });
    log(`  → created designExtensionCone0.id = ${designExtensionCone0.id}`);
  } else {
    log(`  → designExtensionCone0 already exists: ${designExtensionCone0.id}`);
  }

  let designBaseCone1 = await prisma.design.findFirst({
    where: { behaviourId: behaviour.id, biorthoClass: "showcase-cone1-base" },
  });

  if (!designBaseCone1) {
    designBaseCone1 = await prisma.design.create({
      data: {
        behaviourId: behaviour.id,
        deliberationId,
        loci: baseCone1Loci,
        premiseClaimIds: baseCone1PremiseIds,
        biorthoClass: "showcase-cone1-base",
        derivedBy: null, // ← base of cone_1 (alternative incarnation)
      },
    });
    log(`  → created designBaseCone1.id = ${designBaseCone1.id}`);
  } else {
    log(`  → designBaseCone1 already exists: ${designBaseCone1.id}`);
  }

  // ── 6. Upsert DesignInclusion edge (baseCone0 ⊂ extensionCone0) ──────────
  //
  // Phase 2e Cross-Cone Incompatibility: DesignInclusion edges are valid only
  // same-cone. We assert cone-locality here at the seed layer (the schema
  // does not enforce it on its own).

  log("Upserting DesignInclusion edge (cone_0: base ⊂ extension) …");

  // Cone-locality assertion: refuse to insert a cross-cone edge.
  // Per Phase 2e, cone membership is determined by the "most-specific base
  // ancestor" rule: a derived design belongs to the cone of the base whose
  // loci form the largest subset of the derived design's loci.
  function isSubset(a: string[], b: string[]): boolean {
    const bs = new Set(b);
    return a.every((x) => bs.has(x));
  }

  const sameCone =
    designExtensionCone0.derivedBy !== null &&
    isSubset(designBaseCone0.loci, designExtensionCone0.loci) &&
    !isSubset(designBaseCone1.loci, designExtensionCone0.loci);

  if (!sameCone) {
    throw new Error(
      "[seed] Cone-locality assertion failed: refusing to insert cross-cone " +
        "DesignInclusion edge. This indicates a bug in the seed fixture."
    );
  }

  const existingInclusion = await prisma.designInclusion.findUnique({
    where: {
      smallerId_largerId: {
        smallerId: designBaseCone0.id,
        largerId: designExtensionCone0.id,
      },
    },
  });

  if (!existingInclusion) {
    await prisma.designInclusion.create({
      data: { smallerId: designBaseCone0.id, largerId: designExtensionCone0.id },
    });
    log(
      `  → created inclusion: ${designBaseCone0.id} ⊂ ${designExtensionCone0.id}`
    );
  } else {
    log("  → inclusion already exists");
  }

  // ── 7. Upsert WitnessRecords for the first three moves ───────────────────
  //
  // These flip stratumLabel to "walked" so coverage/exposure reads return
  // non-trivial data.  Tied to the first three arguments as dialogueMoveIds
  // (using argument IDs as stand-ins; in production these would be real
  // DialogueMove IDs).

  log("Upserting WitnessRecord rows (first 3 moves) …");

  const WITNESS_COUNT = 3;

  for (let i = 0; i < WITNESS_COUNT; i++) {
    const move = moves[i];
    const dialogueMoveId = `showcase-dialogue-move-${i}`;

    const existing = await prisma.witnessRecord.findUnique({
      where: { dialogueMoveId },
    });

    if (existing) {
      log(`  → WitnessRecord[${i}] already exists`);
      continue;
    }

    await prisma.witnessRecord.create({
      data: {
        ludicMoveId: move.id,
        dialogueMoveId,
        participantId: SHOWCASE_PARTICIPANT_ID,
        canonicalText: `Showcase witness for move at locus ${move.locus}`,
        schemeKey: "showcase",
      },
    });

    // Flip the move's stratumLabel to "walked"
    await prisma.ludicMove.update({
      where: { id: move.id },
      data: { stratumLabel: "walked" },
    });

    log(`  → created WitnessRecord[${i}] for locus ${move.locus}`);
  }

  // ── 8. Summary ────────────────────────────────────────────────────────────

  const finalCounts = await Promise.all([
    prisma.ludicMove.count({ where: { deliberationId } }),
    prisma.witnessRecord.count({ where: { ludicMove: { deliberationId } } }),
    prisma.design.count({ where: { deliberationId } }),
    prisma.designInclusion.count({
      where: { smaller: { deliberationId } },
    }),
  ]);

  console.log("\n" + "=".repeat(72));
  console.log("Seed complete.");
  console.log("=".repeat(72));
  console.log(`  LudicMove rows       : ${finalCounts[0]}`);
  console.log(`  WitnessRecord rows   : ${finalCounts[1]} (${WITNESS_COUNT} walked)`);
  console.log(`  Design rows          : ${finalCounts[2]}`);
  console.log(`  DesignInclusion rows : ${finalCounts[3]}`);
  console.log(`  Behaviour id         : ${behaviour.id}`);
  console.log(`  Design baseCone0 id      : ${designBaseCone0.id}`);
  console.log(`  Design extensionCone0 id : ${designExtensionCone0.id}`);
  console.log(`  Design baseCone1 id      : ${designBaseCone1.id}`);
  console.log("\n  Inc(B) ≥ 2 (multi-cone, post-2e generic case).");
  console.log("\nThese IDs can be used directly in Phase 2a smoke tests.");
  console.log("=".repeat(72) + "\n");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const idArg = process.argv.find((a) => a.startsWith("--deliberation-id="));
const deliberationId = idArg
  ? idArg.split("=")[1]
  : DEFAULT_DELIBERATION_ID;

seedLudicsShowcase(deliberationId)
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("\n[seed] Fatal error:", err);
    prisma.$disconnect();
    process.exit(1);
  });
