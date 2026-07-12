/**
 * Q-018 Phase 0 — folksonomy → ontology catalogue cleanup.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md §Phase 0
 * Audit: audits/q018-ontoclean-20260528.md §3.1–§3.5
 *
 * Idempotent. Safe to re-run. Each step logs its before/after counts.
 *
 * Steps:
 *   1. Delete test placeholders `scheme_test` and `test_scheme`. NULLs the legacy
 *      Argument.schemeId first (NoAction FK would otherwise block). CQ and
 *      ArgumentSchemeInstance rows cascade.
 *   2. Copy dialogue-meta keys (bare_assertion, claim_clarity, claim_relevance,
 *      claim_truth) into the new `DialogueMeta` table and flag the originals
 *      with `kind = 'dialogue-meta'`. The 150 SchemeInstance + 7 CQ refs are
 *      preserved; consumer repoint is tracked as Phase 0.5.
 *   3. Canonicalise cluster name: `causality_family` → `causal_family`.
 *      Adds a conditional CHECK constraint enumerating the allowed cluster tags
 *      for argument-scheme rows.
 *   4. Backfill missing clusterTag values for the four remaining argument-scheme
 *      nulls per the audit's per-scheme rationale.
 */

import { prisma } from "@/lib/prismaclient";

const KEYS_DELETE = ["scheme_test", "test_scheme"] as const;
const KEYS_DIALOGUE_META = [
  "bare_assertion",
  "claim_clarity",
  "claim_relevance",
  "claim_truth",
] as const;

const CLUSTER_BACKFILL: Record<string, string> = {
  cause_to_effect: "causal_family",
  "expert-opinion": "authority_family",
  good_consequences: "practical_reasoning_family",
  sign: "evidence_family",
};

const ALLOWED_CLUSTER_TAGS = [
  "authority_family",
  "causal_family",
  "definition_family",
  "evidence_family",
  "practical_reasoning_family",
  "similarity_family",
] as const;

const CHECK_CONSTRAINT_NAME = "ArgumentScheme_clusterTag_check";

async function step1_deleteTestPlaceholders(): Promise<void> {
  console.log("\n[step1] delete test placeholders");
  const rows = await prisma.argumentScheme.findMany({
    where: { key: { in: KEYS_DELETE as readonly string[] as string[] } },
    select: { id: true, key: true },
  });
  if (rows.length === 0) {
    console.log("  already removed; skipping");
    return;
  }
  const ids = rows.map((r) => r.id);

  // Null out legacy Argument.schemeId (NoAction FK would block delete).
  const nulled = await prisma.argument.updateMany({
    where: { schemeId: { in: ids } },
    data: { schemeId: null },
  });
  console.log(`  nulled Argument.schemeId on ${nulled.count} row(s)`);

  // Cascades: CriticalQuestion, ArgumentSchemeInstance, SchemeInstance,
  // SchemeVariant. parentScheme uses SetNull (no children for these keys).
  const deleted = await prisma.argumentScheme.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(
    `  deleted ${deleted.count} ArgumentScheme row(s): ${rows.map((r) => r.key).join(", ")}`,
  );
}

async function step2_copyDialogueMeta(): Promise<void> {
  console.log("\n[step2] copy dialogue-meta entries to DialogueMeta table");
  const rows = await prisma.argumentScheme.findMany({
    where: { key: { in: KEYS_DIALOGUE_META as readonly string[] as string[] } },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      summary: true,
      cq: true,
      tags: true,
      examples: true,
    },
  });
  if (rows.length === 0) {
    console.log("  no source rows in ArgumentScheme; nothing to copy");
  }
  for (const r of rows) {
    await prisma.dialogueMeta.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        description: r.description,
        summary: r.summary,
        cq: r.cq as any,
        tags: r.tags ?? [],
        examples: r.examples ?? [],
      },
      update: {
        name: r.name,
        description: r.description,
        summary: r.summary,
        cq: r.cq as any,
        tags: r.tags ?? [],
        examples: r.examples ?? [],
      },
    });
  }
  const total = await prisma.dialogueMeta.count();
  console.log(`  DialogueMeta now has ${total} row(s)`);

  // Flag originals with kind discriminator so picker queries can exclude them.
  const flagged = await prisma.argumentScheme.updateMany({
    where: { key: { in: KEYS_DIALOGUE_META as readonly string[] as string[] } },
    data: { kind: "dialogue-meta" as any },
  });
  console.log(`  flagged ${flagged.count} ArgumentScheme row(s) as kind=dialogue-meta`);
}

async function step3_canonicaliseClusterTag(): Promise<void> {
  console.log("\n[step3] canonicalise cluster naming: causality_family → causal_family");
  const renamed = await prisma.argumentScheme.updateMany({
    where: { clusterTag: "causality_family" },
    data: { clusterTag: "causal_family" },
  });
  console.log(`  renamed ${renamed.count} row(s)`);
}

async function step4_backfillClusterTags(): Promise<void> {
  console.log("\n[step4] backfill missing clusterTag values");
  for (const [key, tag] of Object.entries(CLUSTER_BACKFILL)) {
    const result = await prisma.argumentScheme.updateMany({
      where: { key, clusterTag: null },
      data: { clusterTag: tag },
    });
    if (result.count > 0) console.log(`  ${key} → ${tag}`);
  }
}

async function step5_addCheckConstraint(): Promise<void> {
  console.log("\n[step5] enforce CHECK constraint on clusterTag");
  // Drop-if-exists then add, for idempotency.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ArgumentScheme" DROP CONSTRAINT IF EXISTS "${CHECK_CONSTRAINT_NAME}"`,
  );
  const allowed = ALLOWED_CLUSTER_TAGS.map((t) => `'${t}'`).join(", ");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ArgumentScheme" ADD CONSTRAINT "${CHECK_CONSTRAINT_NAME}" CHECK (` +
      `"kind" = 'dialogue-meta' OR "clusterTag" IN (${allowed}))`,
  );
  console.log(`  CHECK enforces clusterTag IN (${allowed}) for argument-scheme rows`);
}

async function verify(): Promise<void> {
  console.log("\n=== POST-VERIFY ===");
  const remainingTest = await prisma.argumentScheme.count({
    where: { OR: [{ key: { contains: "test" } }] },
  });
  console.log(`  ArgumentScheme rows with 'test' in key: ${remainingTest} (target: 0)`);

  const dmCount = await prisma.dialogueMeta.count();
  console.log(`  DialogueMeta rows: ${dmCount} (target: ${KEYS_DIALOGUE_META.length})`);

  const flaggedCount = await prisma.argumentScheme.count({
    where: { kind: "dialogue-meta" } as any,
  });
  console.log(`  ArgumentScheme kind=dialogue-meta: ${flaggedCount}`);

  const tags = await prisma.$queryRawUnsafe<
    { clusterTag: string | null; n: bigint }[]
  >(
    `SELECT "clusterTag", COUNT(*)::bigint AS n FROM "ArgumentScheme" GROUP BY "clusterTag" ORDER BY n DESC`,
  );
  console.log("  clusterTag distribution:");
  console.table(tags.map((t) => ({ clusterTag: t.clusterTag, n: Number(t.n) })));

  const nullArgScheme = await prisma.argumentScheme.count({
    where: { clusterTag: null, kind: "argument-scheme" } as any,
  });
  console.log(`  argument-scheme rows with NULL clusterTag: ${nullArgScheme} (target: 0)`);
}

async function main(): Promise<void> {
  console.log("=== Q-018 Phase 0 — folksonomy → ontology cleanup ===");
  await step1_deleteTestPlaceholders();
  await step2_copyDialogueMeta();
  await step3_canonicaliseClusterTag();
  await step4_backfillClusterTags();
  await step5_addCheckConstraint();
  await verify();
  await prisma.$disconnect();
  console.log("\n=== done ===");
}

main().catch(async (e) => {
  console.error("[phase0] failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
