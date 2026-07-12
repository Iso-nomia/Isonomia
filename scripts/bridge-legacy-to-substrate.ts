/**
 * scripts/bridge-legacy-to-substrate.ts
 *
 * Bridge the legacy Ludics dialogue tables (LudicDesign, LudicAct, LudicLocus,
 * DialogueMove) into the new Generative Substrate tables (Behaviour, Design,
 * LudicMove, WitnessRecord, DesignInclusion) for a single deliberation.
 *
 * After running this, the MCP `get_*` tools — which read only the new
 * substrate — will see the same world the legacy UI Ludics tab has been
 * showing.
 *
 * Mapping rules
 * ─────────────
 *   • Locus address: legacy `LudicLocus.path` (e.g. "0.54.1")
 *     →  substrate locus  `⊢A.0.54.1`   (constant prefix `⊢A.`)
 *
 *   • Behaviour: one row per deliberation at root locus `⊢A.0`
 *     (legacy designs all root at path "0"). Upsert by `(deliberationId,
 *     rootLocus)`.
 *
 *   • Design (substrate): one row per legacy `LudicDesign`. Loci = sorted
 *     distinct substrate-prefixed paths of all acts in that design.
 *     biorthoClass = sha256(sorted loci) so semantically-equal designs
 *     dedupe naturally. derivedBy = null (these ARE base incarnations).
 *     Idempotency key on re-run: `(behaviourId, biorthoClass)`.
 *
 *   • LudicMove: one row per unique `(deliberationId, substrate-locus)`.
 *     designId = the canonical owner (smallest design by loci.length, then
 *     lex id) — `LudicMove.designId` is singular, so when a locus belongs
 *     to several legacy designs we pick a deterministic one.
 *     moveType: "daimon" if any LudicAct at that locus has kind = "DAIMON";
 *     else "positive" if owner.participantId == "Proponent";
 *     else "negative".
 *     stratumLabel: initially "latent"; promoted to "walked" in the
 *     witness pass below.
 *     Upsert by `(deliberationId, locus)`.
 *
 *   • WitnessRecord: one row per `DialogueMove` with a resolvable substrate
 *     locus. dialogueMoveId = DM.id (unique). ludicMoveId from the locus
 *     lookup. participantId = DM.actorId. canonicalText = payload.expression
 *     ?? DM.kind. schemeKey = null. Upsert by `dialogueMoveId`.
 *     Resolution order for the DM's locus:
 *       1. payload.locusPath (string, e.g. "0.54.1")
 *       2. DM.locusId → LudicLocus.path
 *     DMs that resolve to no LudicMove are skipped (counted + reported).
 *
 *   • stratumLabel pass: after WitnessRecords land, set LudicMove.stratumLabel
 *     to "walked" for any move with ≥1 active witness; else leave as
 *     "latent". (We do NOT compute the "witnessable" derivation here —
 *     that requires neighbour analysis; see server/ludics/stratum.ts for
 *     the per-move authoritative recompute.)
 *
 *   • DesignInclusion: for each pair (A,B) in the same behaviour where
 *     A.loci ⊊ B.loci, emit a candidate edge; reduce to Hasse covers
 *     (drop A→C when ∃B with A→B→C). Upsert by `(smallerId, largerId)`.
 *
 * Idempotency
 * ───────────
 * Re-running the script is a no-op when the legacy data is unchanged:
 *   - Behaviour, LudicMove, WitnessRecord, DesignInclusion all upsert on
 *     natural keys defined by `@@unique` in the Prisma schema.
 *   - Substrate Design has no schema-level unique key; we dedupe on
 *     `(behaviourId, biorthoClass)` via a findFirst-then-update path.
 *
 * Usage
 * ─────
 *   npx tsx scripts/bridge-legacy-to-substrate.ts --deliberation-id <id>
 *   npx tsx scripts/bridge-legacy-to-substrate.ts --deliberation-id <id> --dry-run
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prismaclient";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Constant prefix prepended to every legacy locus path. */
const LOCUS_PREFIX = "⊢A.";

/** Root locus address used for the single Behaviour we create. */
const ROOT_LOCUS = `${LOCUS_PREFIX}0`;

// ─── CLI ──────────────────────────────────────────────────────────────────────

interface CliArgs {
  deliberationId: string;
  dryRun: boolean;
  wipeSeeds: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let deliberationId: string | null = null;
  let dryRun = false;
  let wipeSeeds = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--deliberation-id") {
      deliberationId = argv[++i] ?? null;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--wipe-seeds") {
      wipeSeeds = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (!deliberationId) {
    throw new Error(
      "Missing --deliberation-id <id>. Example:\n" +
      "  npx tsx scripts/bridge-legacy-to-substrate.ts --deliberation-id cmoxol76e03748cssx07tvkhd",
    );
  }
  return { deliberationId, dryRun, wipeSeeds };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map legacy path "0.54.1" → substrate "⊢A.0.54.1". */
function toSubstrateLocus(legacyPath: string): string {
  return `${LOCUS_PREFIX}${legacyPath}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(2, 72 - title.length - 4))}`);
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

async function bridge({ deliberationId, dryRun, wipeSeeds }: CliArgs): Promise<void> {
  console.log("=".repeat(72));
  console.log("Legacy → New-Substrate Bridge");
  console.log("=".repeat(72));
  console.log(`Deliberation : ${deliberationId}`);
  console.log(`Mode         : ${dryRun ? "DRY RUN (no writes)" : "WRITE"}`);
  console.log(`Wipe seeds   : ${wipeSeeds ? "YES (substrate Behaviour/Design/LudicMove/WitnessRecord/DesignInclusion will be deleted)" : "no"}`);

  // ── 0. Verify deliberation exists ───────────────────────────────────────
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!delib) throw new Error(`Deliberation ${deliberationId} not found.`);

  // ── 0.5 Optional wipe of pre-existing substrate rows ────────────────────
  if (wipeSeeds) {
    section("Step 0.5 — Wipe existing substrate rows for this deliberation");
    if (dryRun) {
      const [bCnt, dCnt, mCnt, wCnt, iCnt] = await Promise.all([
        prisma.behaviour.count({ where: { deliberationId } }),
        prisma.design.count({ where: { deliberationId } }),
        prisma.ludicMove.count({ where: { deliberationId } }),
        prisma.witnessRecord.count({
          where: { ludicMove: { deliberationId } },
        }),
        prisma.designInclusion.count({
          where: { smaller: { deliberationId } },
        }),
      ]);
      log(`would delete: WitnessRecord=${wCnt}, DesignInclusion=${iCnt}, LudicMove=${mCnt}, Design=${dCnt}, Behaviour=${bCnt}`);
    } else {
      // Order matters — children before parents to satisfy FKs.
      const wDel = await prisma.witnessRecord.deleteMany({
        where: { ludicMove: { deliberationId } },
      });
      const iDel = await prisma.designInclusion.deleteMany({
        where: { smaller: { deliberationId } },
      });
      const mDel = await prisma.ludicMove.deleteMany({
        where: { deliberationId },
      });
      const dDel = await prisma.design.deleteMany({
        where: { deliberationId },
      });
      const bDel = await prisma.behaviour.deleteMany({
        where: { deliberationId },
      });
      log(`deleted: WitnessRecord=${wDel.count}, DesignInclusion=${iDel.count}, LudicMove=${mDel.count}, Design=${dDel.count}, Behaviour=${bDel.count}`);
    }
  }

  // ── 1. Fetch legacy designs + their acts (with locus paths) ─────────────
  section("Step 1 — Load legacy LudicDesign + LudicAct + LudicLocus");

  const legacyDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    select: {
      id: true,
      participantId: true,
      acts: {
        select: {
          id: true,
          kind: true,
          polarity: true,
          locus: { select: { path: true } },
        },
      },
    },
  });

  log(`legacy designs : ${legacyDesigns.length}`);
  if (legacyDesigns.length === 0) {
    console.log("\nNothing to bridge. Exiting.");
    return;
  }

  // Per-design substrate-loci + per-locus metadata (moveType, owner candidate)
  interface DesignBundle {
    legacyId: string;
    participantId: string;
    substrateLoci: string[]; // sorted, unique
    /** path → has DAIMON act at this locus */
    daimonByLocus: Set<string>;
  }
  const bundles: DesignBundle[] = legacyDesigns.map((d) => {
    const lociSet = new Set<string>();
    const daimon = new Set<string>();
    for (const a of d.acts) {
      const p = a.locus?.path;
      if (!p) continue;
      const sl = toSubstrateLocus(p);
      lociSet.add(sl);
      if (String(a.kind).toUpperCase() === "DAIMON") daimon.add(sl);
    }
    return {
      legacyId: d.id,
      participantId: d.participantId,
      substrateLoci: [...lociSet].sort(),
      daimonByLocus: daimon,
    };
  });

  for (const b of bundles) {
    log(`  legacy ${b.legacyId} (${b.participantId}) → ${b.substrateLoci.length} loci`);
  }

  // ── 2. Upsert Behaviour ─────────────────────────────────────────────────
  section("Step 2 — Upsert Behaviour");

  let behaviourId: string;
  if (dryRun) {
    behaviourId = "<dry-run-behaviour-id>";
    log(`would upsert Behaviour(deliberationId, rootLocus=${ROOT_LOCUS})`);
  } else {
    const b = await prisma.behaviour.upsert({
      where: { deliberationId_rootLocus: { deliberationId, rootLocus: ROOT_LOCUS } },
      create: { deliberationId, rootLocus: ROOT_LOCUS },
      update: {},
    });
    behaviourId = b.id;
    log(`behaviour.id = ${behaviourId}`);
  }

  // ── 3. Upsert substrate Design rows ─────────────────────────────────────
  section("Step 3 — Upsert substrate Design rows (one per legacy LudicDesign)");

  /** legacy ludicDesignId → substrate Design.id */
  const designIdByLegacy = new Map<string, string>();
  /** substrate Design.id → sorted loci (for cone + inclusion analysis) */
  const lociByDesignId = new Map<string, string[]>();
  /** substrate Design.id → owning participantId ("Proponent" | "Opponent") */
  const participantByDesignId = new Map<string, string>();

  for (const b of bundles) {
    if (b.substrateLoci.length === 0) {
      log(`  skip legacy ${b.legacyId} — no acts with loci`);
      continue;
    }
    const biorthoClass = sha256Hex(b.substrateLoci.join("|"));

    let designId: string;
    if (dryRun) {
      designId = `<dry-run-design:${b.legacyId}>`;
      log(`  would upsert Design(biorth=${biorthoClass.slice(0, 8)}…) for legacy ${b.legacyId} (${b.substrateLoci.length} loci)`);
    } else {
      const existing = await prisma.design.findFirst({
        where: { behaviourId, biorthoClass },
        select: { id: true },
      });
      if (existing) {
        await prisma.design.update({
          where: { id: existing.id },
          data: { loci: b.substrateLoci, deliberationId, derivedBy: null },
        });
        designId = existing.id;
      } else {
        const created = await prisma.design.create({
          data: {
            behaviourId,
            deliberationId,
            loci: b.substrateLoci,
            premiseClaimIds: [],
            biorthoClass,
            derivedBy: null,
          },
          select: { id: true },
        });
        designId = created.id;
      }
      log(`  legacy ${b.legacyId} → substrate ${designId} (${b.substrateLoci.length} loci)`);
    }
    designIdByLegacy.set(b.legacyId, designId);
    lociByDesignId.set(designId, b.substrateLoci);
    participantByDesignId.set(designId, b.participantId);
  }

  // ── 3.5 Pre-fetch DialogueMoves + resolve each one's substrate locus ──────
  // We do this BEFORE step 4 so that step 4 can also create LudicMoves for
  // loci that are referenced by DMs but never received a LudicAct (otherwise
  // legitimate witnesses would be silently dropped — see the dry-run
  // diagnostic "no-matching-move=52").
  section("Step 3.5 — Load DialogueMoves and resolve substrate loci");

  const dms = await prisma.dialogueMove.findMany({
    where: { deliberationId },
    select: {
      id: true,
      kind: true,
      actorId: true,
      polarity: true,
      locusId: true,
      payload: true,
    },
  });
  log(`DialogueMoves found : ${dms.length}`);

  const locusIdSet = new Set(
    dms.map((m) => m.locusId).filter((x): x is string => Boolean(x)),
  );
  const locusRows = locusIdSet.size
    ? await prisma.ludicLocus.findMany({
        where: { id: { in: [...locusIdSet] } },
        select: { id: true, path: true },
      })
    : [];
  const pathByLocusId = new Map(locusRows.map((r) => [r.id, r.path]));

  /** DM.id → substrate locus (or null if this DM has no locus). */
  const substrateLocusByDmId = new Map<string, string | null>();
  /** Substrate loci referenced by at least one DM. */
  const dmReferencedLoci = new Set<string>();
  /** locus → polarity hint from any DM referencing it ("P" | "O" | undefined). */
  const dmPolarityByLocus = new Map<string, string>();
  let dmNoLocus = 0;

  for (const dm of dms) {
    const payload = (dm.payload ?? null) as { locusPath?: unknown } | null;
    const payloadLocusPath =
      typeof payload?.locusPath === "string" ? payload.locusPath : null;
    const legacyPath =
      payloadLocusPath ??
      (dm.locusId ? pathByLocusId.get(dm.locusId) ?? null : null);
    if (!legacyPath) {
      substrateLocusByDmId.set(dm.id, null);
      dmNoLocus++;
      continue;
    }
    const sl = toSubstrateLocus(legacyPath);
    substrateLocusByDmId.set(dm.id, sl);
    dmReferencedLoci.add(sl);
    if (dm.polarity && !dmPolarityByLocus.has(sl)) {
      dmPolarityByLocus.set(sl, dm.polarity);
    }
  }
  log(`DMs with resolvable locus  : ${dms.length - dmNoLocus}`);
  log(`DMs with no locus (skipped): ${dmNoLocus} (argument-graph layer, not Ludics)`);
  log(`Distinct DM-referenced loci: ${dmReferencedLoci.size}`);

  // ── 4. Upsert LudicMove rows ──────────────────────────────────────
  // One per unique substrate locus drawn from BOTH sources:
  //   - loci spanned by a substrate Design (from LudicAct)
  //   - loci referenced by a DialogueMove that has no act (orphan-locus DMs)
  section("Step 4 — Upsert LudicMove (one per unique substrate locus)");

  // Aggregate: locus → owning substrate designIds; daimon flag from acts
  const designsByLocus = new Map<string, string[]>();
  const daimonAtLocus = new Set<string>();
  for (const b of bundles) {
    const did = designIdByLegacy.get(b.legacyId);
    if (!did) continue;
    for (const l of b.substrateLoci) {
      if (!designsByLocus.has(l)) designsByLocus.set(l, []);
      designsByLocus.get(l)!.push(did);
      if (b.daimonByLocus.has(l)) daimonAtLocus.add(l);
    }
  }

  // Union of locus addresses needing a LudicMove
  const allLoci = new Set<string>([
    ...designsByLocus.keys(),
    ...dmReferencedLoci,
  ]);

  /** substrate locus → LudicMove.id */
  const moveIdByLocus = new Map<string, string>();
  let createdMoves = 0;
  let updatedMoves = 0;
  let dmOnlyMoves = 0; // moves whose locus came only from a DM (no owning design)

  for (const substrateLocus of allLoci) {
    const owners = designsByLocus.get(substrateLocus) ?? [];
    let owner: string | null = null;
    if (owners.length > 0) {
      // Canonical owner: smallest by loci.length, then lex id
      owner = owners
        .map((id) => ({ id, len: lociByDesignId.get(id)?.length ?? Infinity }))
        .sort((a, b) => a.len - b.len || a.id.localeCompare(b.id))[0].id;
    } else {
      dmOnlyMoves++;
    }

    const isDaimon = daimonAtLocus.has(substrateLocus);
    let moveType: string;
    if (isDaimon) {
      moveType = "daimon";
    } else if (owner) {
      moveType = participantByDesignId.get(owner) === "Proponent" ? "positive" : "negative";
    } else {
      // DM-only locus: derive polarity from any DM that touched this locus
      const pol = dmPolarityByLocus.get(substrateLocus);
      moveType = pol === "P" ? "positive" : pol === "O" ? "negative" : "positive";
    }

    if (dryRun) {
      log(`  would upsert LudicMove(${substrateLocus}, type=${moveType}, owner=${owner ?? "—"})`);
      continue;
    }

    const existing = await prisma.ludicMove.findUnique({
      where: { deliberationId_locus: { deliberationId, locus: substrateLocus } },
      select: { id: true },
    });
    if (existing) {
      await prisma.ludicMove.update({
        where: { id: existing.id },
        data: { moveType, designId: owner },
      });
      moveIdByLocus.set(substrateLocus, existing.id);
      updatedMoves++;
    } else {
      const created = await prisma.ludicMove.create({
        data: {
          deliberationId,
          locus: substrateLocus,
          moveType,
          stratumLabel: "latent", // promoted below if witnessed
          designId: owner,
        },
        select: { id: true },
      });
      moveIdByLocus.set(substrateLocus, created.id);
      createdMoves++;
    }
  }
  log(`LudicMove totals: created ${createdMoves}, updated ${updatedMoves}, unique loci ${allLoci.size}`);
  log(`  of which DM-only (no owning design): ${dmOnlyMoves}`);

  // ── 5. Upsert WitnessRecord (one per DialogueMove with resolvable locus) ─
  section("Step 5 — Upsert WitnessRecord from DialogueMove");

  let witnessesCreated = 0;
  let witnessesUpdated = 0;
  let dmSkippedNoLocus = 0;
  let dmSkippedNoMove = 0;
  const witnessedMoveIds = new Set<string>();

  for (const dm of dms) {
    const substrateLocus = substrateLocusByDmId.get(dm.id);
    if (!substrateLocus) {
      dmSkippedNoLocus++;
      continue;
    }
    const ludicMoveId = dryRun ? "<dry-run>" : moveIdByLocus.get(substrateLocus);
    if (!ludicMoveId) {
      // Should not happen now — step 4 creates a LudicMove for every
      // DM-referenced locus. Kept as a safety counter.
      dmSkippedNoMove++;
      continue;
    }
    const payload = (dm.payload ?? null) as { expression?: unknown } | null;
    witnessedMoveIds.add(ludicMoveId);

    const canonicalText =
      typeof payload?.expression === "string" && payload.expression.length > 0
        ? payload.expression
        : dm.kind ?? "DM";

    if (dryRun) {
      witnessesCreated++;
      continue;
    }

    const existing = await prisma.witnessRecord.findUnique({
      where: { dialogueMoveId: dm.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.witnessRecord.update({
        where: { id: existing.id },
        data: {
          ludicMoveId,
          participantId: dm.actorId,
          canonicalText,
          schemeKey: null,
          // re-activate if previously fossilized; the legacy DM still exists
          fossilizedAt: null,
          retractLayer: null,
          retractReason: null,
        },
      });
      witnessesUpdated++;
    } else {
      await prisma.witnessRecord.create({
        data: {
          ludicMoveId,
          dialogueMoveId: dm.id,
          participantId: dm.actorId,
          canonicalText,
          schemeKey: null,
        },
      });
      witnessesCreated++;
    }
  }

  log(`WitnessRecord totals: created ${witnessesCreated}, updated ${witnessesUpdated}`);
  log(`Skipped DMs: no locus=${dmSkippedNoLocus}, locus has no LudicMove=${dmSkippedNoMove}`);

  // ── 6. Promote stratumLabel = "walked" for witnessed moves ──────────────
  section("Step 6 — Promote stratumLabel to 'walked' for witnessed LudicMoves");

  let promoted = 0;
  if (!dryRun && witnessedMoveIds.size > 0) {
    const res = await prisma.ludicMove.updateMany({
      where: { id: { in: [...witnessedMoveIds] }, stratumLabel: { not: "walked" } },
      data: { stratumLabel: "walked" },
    });
    promoted = res.count;
  } else if (dryRun) {
    promoted = witnessedMoveIds.size;
  }
  log(`promoted ${promoted} LudicMove(s) → walked`);

  // ── 7. Build DesignInclusion Hasse covers ───────────────────────────────
  section("Step 7 — Build DesignInclusion Hasse covers");

  const designIds = [...lociByDesignId.keys()];
  // Candidate edges: A → B iff A.loci ⊊ B.loci
  const candidates: Array<{ smallerId: string; largerId: string }> = [];
  for (const a of designIds) {
    const la = new Set(lociByDesignId.get(a)!);
    for (const b of designIds) {
      if (a === b) continue;
      const lb = lociByDesignId.get(b)!;
      if (lb.length <= la.size) continue; // strict ⊂ requires |B| > |A|
      let subset = true;
      for (const x of la) {
        if (!lb.includes(x)) {
          subset = false;
          break;
        }
      }
      if (subset) candidates.push({ smallerId: a, largerId: b });
    }
  }

  // Hasse reduction: drop (A,C) if exists B with (A,B) and (B,C)
  const edgeSet = new Set(candidates.map((e) => `${e.smallerId}|${e.largerId}`));
  const covers = candidates.filter((e) => {
    for (const mid of designIds) {
      if (mid === e.smallerId || mid === e.largerId) continue;
      if (
        edgeSet.has(`${e.smallerId}|${mid}`) &&
        edgeSet.has(`${mid}|${e.largerId}`)
      ) {
        return false;
      }
    }
    return true;
  });

  log(`candidate edges: ${candidates.length}, Hasse covers: ${covers.length}`);
  let inclCreated = 0;
  let inclSkipped = 0;
  for (const e of covers) {
    if (dryRun) {
      log(`  would upsert DesignInclusion(${e.smallerId} ⊂ ${e.largerId})`);
      continue;
    }
    const existing = await prisma.designInclusion.findUnique({
      where: { smallerId_largerId: { smallerId: e.smallerId, largerId: e.largerId } },
      select: { id: true },
    });
    if (existing) {
      inclSkipped++;
    } else {
      await prisma.designInclusion.create({ data: e });
      inclCreated++;
    }
  }
  log(`DesignInclusion totals: created ${inclCreated}, already-present ${inclSkipped}`);

  // ── 8. Backfill Design.premiseClaimIds via AIF walk ─────────────────────
  // Strict option (b) — walk LudicAct → AifNode → outgoing AifEdges of
  // role 'premise' → premise AifNode → text-match to Claim.text in the
  // deliberation. The text-match is structurally required because AifNode
  // has no FK to Claim — the AIF I-node IS the claim representation. We
  // normalize (trim + lowercase + collapse whitespace) and report
  // resolved/unresolved counts so callers can decide whether to add a
  // fallback path (e.g. via DialogueMove.payload.argumentId → ArgumentPremise).
  section("Step 8 — Backfill Design.premiseClaimIds via AIF graph walk");

  const allLegacyDesignIds = bundles.map((b) => b.legacyId);
  // 8.1  LudicActs → AifNode ids, grouped by legacy designId.
  const legacyActs = await prisma.ludicAct.findMany({
    where: { designId: { in: allLegacyDesignIds } },
    select: {
      id: true,
      designId: true,
      aifNode: { select: { id: true, nodeKind: true } },
    },
  });
  const aifNodesByLegacyDesign = new Map<string, string[]>();
  const allActAifIds: string[] = [];
  for (const a of legacyActs) {
    if (!a.aifNode) continue;
    allActAifIds.push(a.aifNode.id);
    const arr = aifNodesByLegacyDesign.get(a.designId) ?? [];
    arr.push(a.aifNode.id);
    aifNodesByLegacyDesign.set(a.designId, arr);
  }
  log(`legacy LudicActs       : ${legacyActs.length}`);
  log(`acts with AifNode link : ${allActAifIds.length}`);

  // 8.2  Premise edges into those AifNodes (edgeRole='premise', target=actAifNode).
  const premiseEdges = allActAifIds.length
    ? await prisma.aifEdge.findMany({
        where: {
          deliberationId,
          edgeRole: "premise",
          targetId: { in: allActAifIds },
        },
        select: { sourceId: true, targetId: true },
      })
    : [];
  log(`AIF premise edges in   : ${premiseEdges.length}`);

  // 8.3  Premise AifNode texts.
  const premiseSourceIds = [...new Set(premiseEdges.map((e) => e.sourceId))];
  const premiseNodes = premiseSourceIds.length
    ? await prisma.aifNode.findMany({
        where: { id: { in: premiseSourceIds }, deliberationId },
        select: { id: true, text: true },
      })
    : [];
  const normalize = (s: string | null | undefined): string =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const normTextByAifId = new Map<string, string>();
  for (const n of premiseNodes) {
    const norm = normalize(n.text);
    if (norm) normTextByAifId.set(n.id, norm);
  }

  // 8.4  Claim text → id index for this deliberation.
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true, text: true },
  });
  const claimIdByNormText = new Map<string, string>();
  for (const c of claims) {
    const norm = normalize(c.text);
    if (norm && !claimIdByNormText.has(norm)) {
      claimIdByNormText.set(norm, c.id);
    }
  }
  log(`Claims in deliberation : ${claims.length}`);

  // 8.5  For each substrate Design, resolve premise claim ids.
  let designsWithPremises = 0;
  let designsUpdated = 0;
  let premisesResolved = 0;
  let premisesUnresolved = 0;
  const resolvedClaimIdsByDesign = new Map<string, Set<string>>();
  for (const [legacyId, substrateDesignId] of designIdByLegacy.entries()) {
    const actIds = aifNodesByLegacyDesign.get(legacyId);
    const claimIds = new Set<string>();
    if (actIds && actIds.length > 0) {
      const actIdSet = new Set(actIds);
      for (const e of premiseEdges) {
        if (!actIdSet.has(e.targetId)) continue;
        const ptext = normTextByAifId.get(e.sourceId);
        if (!ptext) {
          premisesUnresolved++;
          continue;
        }
        const cid = claimIdByNormText.get(ptext);
        if (cid) {
          claimIds.add(cid);
          premisesResolved++;
        } else {
          premisesUnresolved++;
        }
      }
    }
    resolvedClaimIdsByDesign.set(substrateDesignId, claimIds);
  }

  // 8.6  Fallback path — for any Design where the AIF walk resolved nothing,
  // route through DialogueMove.payload.argumentId → ArgumentPremise.claimId.
  // This is pure-FK structural (no text matching) and works whenever the
  // deliberation's argument layer is populated even if its AIF graph is
  // skeletal (the common case: AIF carries DM-stub nodes only, with
  // premise/conclusion structure living on Argument/ArgumentPremise).
  // We attribute a DM's argument to every Design that owns its locus.
  section("Step 8.6 — Fallback: route DialogueMove → Argument → ArgumentPremise");

  // Collect DM argumentIds, attributed to each owning Design via locus.
  const argIdsByDesign = new Map<string, Set<string>>();
  let dmsWithArgumentId = 0;
  for (const dm of dms) {
    const substrateLocus = substrateLocusByDmId.get(dm.id);
    if (!substrateLocus) continue;
    const payload = (dm.payload ?? null) as { argumentId?: unknown } | null;
    const argumentId =
      typeof payload?.argumentId === "string" && payload.argumentId.length > 0
        ? payload.argumentId
        : null;
    if (!argumentId) continue;
    dmsWithArgumentId++;
    const owners = designsByLocus.get(substrateLocus) ?? [];
    for (const did of owners) {
      const set = argIdsByDesign.get(did) ?? new Set<string>();
      set.add(argumentId);
      argIdsByDesign.set(did, set);
    }
  }
  log(`DMs carrying argumentId: ${dmsWithArgumentId}`);

  // Bulk-load ArgumentPremise rows for all collected argumentIds.
  const allArgIds = [...new Set([...argIdsByDesign.values()].flatMap((s) => [...s]))];
  const argPremises = allArgIds.length
    ? await prisma.argumentPremise.findMany({
        where: { argumentId: { in: allArgIds } },
        select: { argumentId: true, claimId: true },
      })
    : [];
  const claimIdsByArgId = new Map<string, string[]>();
  for (const p of argPremises) {
    const arr = claimIdsByArgId.get(p.argumentId) ?? [];
    arr.push(p.claimId);
    claimIdsByArgId.set(p.argumentId, arr);
  }
  log(`ArgumentPremise rows looked up: ${argPremises.length}`);

  let fallbackUsedCount = 0;
  let fallbackClaimsAdded = 0;
  for (const [substrateDesignId, claimIds] of resolvedClaimIdsByDesign.entries()) {
    if (claimIds.size > 0) continue; // AIF walk already resolved this design
    const argIds = argIdsByDesign.get(substrateDesignId);
    if (!argIds || argIds.size === 0) continue;
    let added = 0;
    for (const argId of argIds) {
      const cids = claimIdsByArgId.get(argId);
      if (!cids) continue;
      for (const cid of cids) {
        if (!claimIds.has(cid)) {
          claimIds.add(cid);
          added++;
        }
      }
    }
    if (added > 0) {
      fallbackUsedCount++;
      fallbackClaimsAdded += added;
    }
  }
  log(`Designs filled via fallback: ${fallbackUsedCount} (+${fallbackClaimsAdded} claim refs)`);

  // 8.7  Persist resolved premise claim ids.
  for (const [substrateDesignId, claimIds] of resolvedClaimIdsByDesign.entries()) {
    if (claimIds.size === 0) continue;
    designsWithPremises++;
    const sorted = [...claimIds].sort();
    if (dryRun) {
      log(`  would set Design(${substrateDesignId}).premiseClaimIds = [${sorted.length} claim(s)]`);
      designsUpdated++;
    } else {
      await prisma.design.update({
        where: { id: substrateDesignId },
        data: { premiseClaimIds: sorted },
      });
      designsUpdated++;
    }
  }
  log(`Designs with premises  : ${designsWithPremises}`);
  log(`Designs updated        : ${designsUpdated}`);
  log(`Premise edges resolved : ${premisesResolved} (AIF walk)`);
  log(`Premise edges unresolved (no I-node text or no matching Claim): ${premisesUnresolved}`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(72));
  console.log("Bridge complete." + (dryRun ? "  (dry run — no writes)" : ""));
  console.log("=".repeat(72));
  console.log(`Behaviour          : 1 (${ROOT_LOCUS})`);
  console.log(`Designs (substrate): ${designIdByLegacy.size}`);
  console.log(`LudicMoves         : ${allLoci.size} (act-derived ${designsByLocus.size}, DM-only ${dmOnlyMoves})`);
  console.log(`WitnessRecords     : ${witnessesCreated + witnessesUpdated} (created ${witnessesCreated}, updated ${witnessesUpdated})`);
  console.log(`Walked LudicMoves  : ${promoted}`);
  console.log(`DesignInclusions   : ${covers.length} cover edges`);
  console.log(`Designs w/ premises: ${designsWithPremises} (${premisesResolved} resolved / ${premisesUnresolved} unresolved)`);
  console.log(`Skipped DMs        : no-locus=${dmSkippedNoLocus}, no-matching-move=${dmSkippedNoMove}`);
}

// ─── entry ────────────────────────────────────────────────────────────────────

bridge(parseArgs())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nBridge failed:");
    console.error(err);
    process.exit(1);
  });
