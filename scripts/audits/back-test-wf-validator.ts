/**
 * Phase 3 step 11 back-test.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md §Phase 3 step 11.
 *
 * Runs the WF1/WF2/WF3 validator over every kind='argument-scheme' row
 * (with its parent context, if any) and reports which rows would be
 * rejected. The plan's exit criterion for step 11 is "back-test produces
 * no surprise failures" — i.e., zero error-severity violations across the
 * live catalogue.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/audits/back-test-wf-validator.ts
 */

import { prisma } from "@/lib/prismaclient";
import {
  validateSchemePresentation,
  type ParentSchemeShape,
  type SchemeDraft,
} from "@/lib/schemes/validation/validatePresentation";

type Row = {
  id: string;
  key: string;
  parentSchemeId: string | null;
  cqs: Array<{
    cqKey: string | null;
    text: string | null;
    attackType: string | null;
    targetScope: string | null;
  }>;
};

function toDraft(row: Row): SchemeDraft {
  return {
    key: row.key,
    parentSchemeId: row.parentSchemeId,
    cqs: row.cqs.map((c) => ({
      cqKey: c.cqKey,
      text: c.text,
      attackType: c.attackType,
      targetScope: c.targetScope,
    })),
  };
}

function toParentShape(row: Row): ParentSchemeShape {
  return {
    id: row.id,
    key: row.key,
    cqs: row.cqs.map((c) => ({
      cqKey: c.cqKey,
      text: c.text,
      attackType: c.attackType,
      targetScope: c.targetScope,
    })),
  };
}

async function main(): Promise<void> {
  console.log("=== Phase 3 step 11 — WF validator back-test ===");
  const rows = (await prisma.argumentScheme.findMany({
    where: { kind: "argument-scheme" } as any,
    include: { cqs: true },
  })) as unknown as Row[];
  console.log(`loaded ${rows.length} kind='argument-scheme' row(s)`);

  const byId = new Map(rows.map((r) => [r.id, r]));

  let okCount = 0;
  let warnOnlyCount = 0;
  const failures: Array<{
    key: string;
    errors: ReturnType<typeof validateSchemePresentation> extends infer R
      ? R extends { errors: infer E }
        ? E
        : never
      : never;
  }> = [];
  const allWarnings: Array<{ key: string; rule: string; message: string }> = [];

  for (const row of rows) {
    const parent = row.parentSchemeId ? byId.get(row.parentSchemeId) ?? null : null;
    const result = validateSchemePresentation(toDraft(row), {
      parentScheme: parent ? toParentShape(parent) : null,
    });
    if (result.ok) {
      okCount += 1;
      if (result.warnings.length > 0) {
        warnOnlyCount += 1;
        for (const w of result.warnings) {
          allWarnings.push({ key: row.key, rule: w.rule, message: w.message });
        }
      }
    } else {
      failures.push({ key: row.key, errors: result.errors as any });
      for (const w of result.warnings) {
        allWarnings.push({ key: row.key, rule: w.rule, message: w.message });
      }
    }
  }

  console.log(`\nresults: ${okCount} ok (${warnOnlyCount} with warnings), ${failures.length} fail`);

  if (allWarnings.length > 0) {
    console.log(`\n--- warnings (${allWarnings.length}) ---`);
    for (const w of allWarnings) {
      console.log(`  [${w.rule}] ${w.key}: ${w.message}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n--- failures (${failures.length}) ---`);
    for (const f of failures) {
      console.log(`  ${f.key}:`);
      for (const e of f.errors as any[]) {
        console.log(`    [${e.rule}] ${e.message}`);
      }
    }
  }

  await prisma.$disconnect();

  if (failures.length > 0) {
    console.error(`\n=== FAIL — ${failures.length} row(s) would be rejected by validator ===`);
    process.exit(1);
  }
  console.log("\n=== PASS — every catalogue row passes WF1/WF2/WF3 ===");
}

main().catch(async (e) => {
  console.error("[back-test-wf-validator] failed:", e);
  await prisma.$disconnect();
  process.exit(2);
});
