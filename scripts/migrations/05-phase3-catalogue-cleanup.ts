/**
 * Phase 3 step 11 — catalogue cleanup before WF1/WF2/WF3 validator enforcement.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md
 *   §Phase 3 step 11 ("back-test produces no surprise failures").
 *
 * Back-test (scripts/audits/back-test-wf-validator.ts) surfaced 7/25 failures
 * rooted in two structural issues:
 *
 *   (a) `practical_reasoning` parent row carries 3 legacy CQs
 *       (`alternatives`, `feasible`, `side_effects`) that duplicate the
 *       canonical Walton PR.* CQs with different `attackType`/`targetScope`.
 *       Decision: drop the 3 legacy CQs. Spec 2 §3.2 — same scheme cannot
 *       host two CQs targeting the same Walton concept with different
 *       structural fields.
 *
 *   (b) Six "child" schemes carry `parentSchemeId` edges that semantically
 *       denote *sibling-in-family*, not Walton-subtype inheritance. Each has
 *       a fully disjoint CQ-key set from its supposed parent. WF3
 *       (monotonicity) is the wrong frame; these are peers within a cluster.
 *       Decision: null the `parentSchemeId` on each. `clusterTag` already
 *       preserves the family relationship.
 *
 *       Affected (parent → null):
 *         negative_consequences (was → practical_reasoning)
 *         positive_consequences (was → practical_reasoning)
 *         value_based_pr        (was → practical_reasoning)
 *         slippery_slope        (was → negative_consequences)
 *         definition_to_classification (was → verbal_classification)
 *         popular_practice      (was → popular_opinion)
 *
 *   (c) `expert-opinion` (dashed) is a 2-CQ stub with null structural
 *       fields, duplicate of the well-formed `expert_opinion` (underscored).
 *       Decision: delete the stub row + its CQs.
 *
 * Fingerprint impact: `computeBehaviourFingerprint` is local (does not walk
 * parents), so only `practical_reasoning` needs a recompute (CQ set
 * shrinks). The 6 demoted children are unchanged. The deleted row drops
 * its fingerprint with it.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/migrations/05-phase3-catalogue-cleanup.ts
 *   npx tsx --env-file=.env scripts/migrations/05-phase3-catalogue-cleanup.ts --apply
 *
 * Dry-run by default; pass --apply to commit.
 */

import { prisma } from "@/lib/prismaclient";
import { recomputeSchemeFingerprint } from "@/lib/schemes/persistence/recomputeSchemeFingerprint";

const APPLY = process.argv.includes("--apply");

const PRACTICAL_REASONING_LEGACY_CQ_KEYS = ["alternatives", "feasible", "side_effects"];
const DEMOTE_PARENT_KEYS = [
  "negative_consequences",
  "positive_consequences",
  "value_based_pr",
  "slippery_slope",
  "definition_to_classification",
  "popular_practice",
];
const DELETE_KEYS = ["expert-opinion"];

async function main(): Promise<void> {
  console.log(`=== Phase 3 step 11 — catalogue cleanup  (${APPLY ? "APPLY" : "dry-run"}) ===`);

  // (a) Drop legacy CQs from practical_reasoning.
  const pr = await prisma.argumentScheme.findUnique({
    where: { key: "practical_reasoning" } as any,
    include: { cqs: true },
  });
  if (!pr) {
    console.error("practical_reasoning row not found — aborting");
    process.exit(2);
  }
  const legacyCqs = (pr as any).cqs.filter((c: any) =>
    PRACTICAL_REASONING_LEGACY_CQ_KEYS.includes(c.cqKey ?? ""),
  );
  console.log(
    `[a] practical_reasoning: ${legacyCqs.length} legacy CQs to drop (${legacyCqs.map((c: any) => c.cqKey).join(", ")})`,
  );

  // (b) Demote parent edges.
  const demoteRows = await prisma.argumentScheme.findMany({
    where: { key: { in: DEMOTE_PARENT_KEYS } } as any,
  });
  console.log(`[b] parent-edge demotions: ${demoteRows.length}/${DEMOTE_PARENT_KEYS.length} found`);
  for (const row of demoteRows as any[]) {
    console.log(`    - ${row.key}: parent ${row.parentSchemeId ?? "(none)"} → null`);
  }

  // (c) Delete stub row.
  const stubs = await prisma.argumentScheme.findMany({
    where: { key: { in: DELETE_KEYS } } as any,
    include: { cqs: true },
  });
  console.log(`[c] stubs to delete: ${stubs.length}`);
  for (const s of stubs as any[]) {
    console.log(`    - ${s.key} (${s.cqs.length} CQs)`);
  }

  if (!APPLY) {
    console.log("\n(dry-run; pass --apply to commit)");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    // (a)
    if (legacyCqs.length > 0) {
      await tx.criticalQuestion.deleteMany({
        where: { id: { in: legacyCqs.map((c: any) => c.id) } },
      });
    }
    // (b)
    if (demoteRows.length > 0) {
      await tx.argumentScheme.updateMany({
        where: { id: { in: (demoteRows as any[]).map((r) => r.id) } },
        data: { parentSchemeId: null },
      });
    }
    // (c)
    for (const s of stubs as any[]) {
      await tx.criticalQuestion.deleteMany({ where: { schemeId: s.id } });
      await tx.argumentScheme.delete({ where: { id: s.id } });
    }
  });

  // Recompute fingerprint for practical_reasoning (CQ set changed).
  if (legacyCqs.length > 0) {
    const fp = await recomputeSchemeFingerprint(pr.id);
    console.log(`\nrecomputed practical_reasoning fingerprint: ${(fp ?? "").slice(0, 16)}…`);
  }

  console.log("\n=== applied ===");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[05-phase3-catalogue-cleanup] failed:", e);
  await prisma.$disconnect();
  process.exit(2);
});
