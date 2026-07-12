// scripts/check-practical-reasoning-seed-drift.ts
//
// Idempotent check/cleanup for the practical-reasoning family after the
// 2026-06-12 seed reconciliation (see
// RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/11b-practical-reasoning-enhancements-2026-06-12.md,
// item 1). The family is now owned solely by scripts/seed.practical-reasoning.ts
// (seed "B"); scripts/schemes.seed.ts (seed "A") no longer defines these keys.
//
// Because both seed scripts upserted CriticalQuestion rows by (schemeId, cqKey)
// WITHOUT deleting stale rows, any database where BOTH scripts ran historically
// can hold orphaned "thin" CQs (e.g. practical_reasoning with 3 thin + 6
// canonical = 9). A re-seed of B does NOT remove those. This script detects and
// (with --fix) removes exactly the known stale cqKeys, and corrects the
// practical_reasoning materialRelation drift ("cause" -> "practical").
//
// Read-only by default. Pass --fix to apply. Pass --verbose for per-row detail.
//
//   npx tsx --env-file=.env scripts/check-practical-reasoning-seed-drift.ts
//   npx tsx --env-file=.env scripts/check-practical-reasoning-seed-drift.ts --fix
//
// Idempotent: safe to run repeatedly. On a clean DB it reports "no drift" and
// changes nothing.

import { prisma } from "../lib/prismaclient";
import { premiseTypeFor } from "../lib/schemes/practical-premise-types";

const FIX = process.argv.includes("--fix");
const VERBOSE = process.argv.includes("--verbose");

// The canonical cqKeys each family scheme should have AFTER reconciliation
// (source of truth: scripts/seed.practical-reasoning.ts, seed "B").
const CANONICAL: Record<string, string[]> = {
  practical_reasoning: [
    "PR.GOAL_ACCEPTED",
    "PR.MEANS_EFFECTIVE",
    "PR.ALTERNATIVES",
    "PR.SIDE_EFFECTS",
    "PR.FEASIBILITY",
    "PR.PERMISSIBILITY",
  ],
  positive_consequences: ["PC.LIKELIHOOD", "PC.SIGNIFICANCE", "PC.NEG_SIDE"],
  negative_consequences: ["NC.LIKELIHOOD", "NC.MITIGATION", "NC.TRADEOFFS"],
};

// The stale cqKeys that the retired seed "A" entries created. These are the ONLY
// rows --fix will delete (a closed allow-list, so we never touch unknown CQs).
const STALE: Record<string, string[]> = {
  practical_reasoning: ["alternatives", "feasible", "side_effects"],
  positive_consequences: ["tradeoffs", "uncertain"],
  negative_consequences: ["mitigate", "exaggerated"],
};

// Expected taxonomy corrections (seed "B" had a Macagno error on PR).
const MATERIAL_RELATION: Record<string, string> = {
  practical_reasoning: "practical",
};

async function main() {
  console.log(
    `practical-reasoning seed-drift check — mode: ${FIX ? "FIX" : "DRY-RUN (read-only)"}\n`
  );

  let driftFound = false;
  let staleDeleted = 0;
  let relationsFixed = 0;
  let premiseTypesFixed = 0;

  for (const key of Object.keys(CANONICAL)) {
    const scheme = await prisma.argumentScheme.findUnique({
      where: { key },
      include: { cqs: { select: { id: true, cqKey: true, premiseType: true } } },
    });

    if (!scheme) {
      console.log(`• ${key}: NOT PRESENT in this DB (skipping)`);
      continue;
    }

    const presentKeys = scheme.cqs
      .map((c) => c.cqKey)
      .filter((k): k is string => !!k);
    const canonical = CANONICAL[key];
    const staleAllow = STALE[key] ?? [];

    // 1) Stale CQ rows (closed allow-list intersected with what's present).
    const staleRows = scheme.cqs.filter(
      (c) => c.cqKey && staleAllow.includes(c.cqKey)
    );

    // 2) Missing canonical CQ rows (re-run seed B to add these; we do NOT create
    //    them here — creation is the seeder's job, deletion is ours).
    const missingCanonical = canonical.filter((k) => !presentKeys.includes(k));

    // 3) materialRelation drift.
    const wantRelation = MATERIAL_RELATION[key];
    const relationDrift =
      wantRelation !== undefined && scheme.materialRelation !== wantRelation;

    // 4) premiseType drift (Item 4): a mapped CQ whose stored premiseType does
    //    not match the canonical Carneades assignment.
    const premiseTypeDrift = scheme.cqs.filter((c) => {
      if (!c.cqKey) return false;
      const want = premiseTypeFor(key, c.cqKey);
      return want !== undefined && c.premiseType !== want;
    });

    if (staleRows.length || missingCanonical.length || relationDrift || premiseTypeDrift.length) {
      driftFound = true;
      console.log(
        `• ${key}: ${scheme.cqs.length} CQ rows; materialRelation="${scheme.materialRelation}"`
      );
      if (staleRows.length) {
        console.log(
          `    stale CQs (${staleRows.length}): ${staleRows.map((r) => r.cqKey).join(", ")}`
        );
      }
      if (missingCanonical.length) {
        console.log(
          `    missing canonical CQs (${missingCanonical.length}): ${missingCanonical.join(", ")} — re-run scripts/seed.practical-reasoning.ts to add`
        );
      }
      if (relationDrift) {
        console.log(
          `    materialRelation drift: "${scheme.materialRelation}" → "${wantRelation}"`
        );
      }
      if (premiseTypeDrift.length) {
        console.log(
          `    premiseType drift (${premiseTypeDrift.length}): ${premiseTypeDrift
            .map((r) => `${r.cqKey} "${r.premiseType ?? "null"}"→"${premiseTypeFor(key, r.cqKey!)}"`)
            .join(", ")}`
        );
      }
    } else if (VERBOSE) {
      console.log(`• ${key}: clean (${scheme.cqs.length} CQs, materialRelation OK, premiseTypes OK)`);
    }

    if (FIX) {
      if (staleRows.length) {
        const res = await prisma.criticalQuestion.deleteMany({
          where: { id: { in: staleRows.map((r) => r.id) } },
        });
        staleDeleted += res.count;
        console.log(`    ✓ deleted ${res.count} stale CQ row(s) for ${key}`);
      }
      if (relationDrift) {
        await prisma.argumentScheme.update({
          where: { key },
          data: { materialRelation: wantRelation },
        });
        relationsFixed += 1;
        console.log(`    ✓ set ${key}.materialRelation = "${wantRelation}"`);
      }
      for (const r of premiseTypeDrift) {
        const want = premiseTypeFor(key, r.cqKey!)!;
        await prisma.criticalQuestion.update({
          where: { id: r.id },
          data: { premiseType: want },
        });
        premiseTypesFixed += 1;
        console.log(`    ✓ set ${key}.${r.cqKey}.premiseType = "${want}"`);
      }
    }
  }

  console.log("");
  if (!driftFound) {
    console.log("No drift detected — DB is consistent with the reconciled seeds.");
  } else if (FIX) {
    console.log(
      `Applied: deleted ${staleDeleted} stale CQ row(s); fixed ${relationsFixed} materialRelation(s); set ${premiseTypesFixed} premiseType(s).`
    );
    console.log(
      "Note: missing canonical CQs (if any) are added by re-running scripts/seed.practical-reasoning.ts, not by this script."
    );
  } else {
    console.log(
      "Drift detected. Re-run with --fix to delete stale CQs, correct materialRelation, and set premiseTypes."
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
