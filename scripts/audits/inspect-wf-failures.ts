/**
 * One-shot inspector — print scheme→parent→CQ-set diff for back-test failures.
 *
 * Run: npx tsx --env-file=.env scripts/audits/inspect-wf-failures.ts
 */
import { prisma } from "@/lib/prismaclient";

const FAILING = [
  "negative_consequences",
  "positive_consequences",
  "value_based_pr",
  "definition_to_classification",
  "slippery_slope",
  "popular_practice",
  "expert-opinion",
];

async function main() {
  const rows = (await prisma.argumentScheme.findMany({
    where: { kind: "argument-scheme" } as any,
    include: { cqs: true, parentScheme: { include: { cqs: true } } as any },
  })) as any[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const key of FAILING) {
    const r = rows.find((x) => x.key === key);
    if (!r) {
      console.log(`MISSING row: ${key}\n`);
      continue;
    }
    const parent = r.parentSchemeId ? byId.get(r.parentSchemeId) : null;
    console.log(`=== ${key} ===`);
    console.log(`  parent: ${parent?.key ?? "(none)"}`);
    console.log(
      `  child CQs (${r.cqs.length}): ${r.cqs.map((c: any) => c.cqKey).join(", ") || "(none)"}`,
    );
    if (parent) {
      console.log(
        `  parent CQs (${parent.cqs.length}): ${parent.cqs.map((c: any) => c.cqKey).join(", ") || "(none)"}`,
      );
      const childKeys = new Set(r.cqs.map((c: any) => c.cqKey));
      const missing = parent.cqs.filter((c: any) => !childKeys.has(c.cqKey));
      console.log(
        `  missing in child: ${missing.map((c: any) => c.cqKey).join(", ") || "(none)"}`,
      );
    }
    // For WF2-vacuous diagnosis
    for (const c of r.cqs) {
      if (!c.targetScope || !c.attackType) {
        console.log(`  WF2: cq=${c.cqKey} attackType=${c.attackType} targetScope=${c.targetScope} text="${(c.text ?? "").slice(0, 40)}"`);
      }
    }
    console.log("");
  }
  await prisma.$disconnect();
}
main();
