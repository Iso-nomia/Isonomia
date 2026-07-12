/**
 * Deep inspector — full CQ rows for the back-test failure cluster + their
 * relatives. Used to plan the catalogue fix-up.
 *
 * Run: npx tsx --env-file=.env scripts/audits/inspect-wf-failures-deep.ts
 */
import { prisma } from "@/lib/prismaclient";

const KEYS = [
  // failures
  "negative_consequences",
  "positive_consequences",
  "value_based_pr",
  "definition_to_classification",
  "slippery_slope",
  "popular_practice",
  "expert-opinion",
  // their parents / relatives
  "practical_reasoning",
  "verbal_classification",
  "popular_opinion",
  "expert_opinion",
];

async function main() {
  const rows = (await prisma.argumentScheme.findMany({
    where: { key: { in: KEYS } } as any,
    include: { cqs: true },
  })) as any[];

  for (const k of KEYS) {
    const r = rows.find((x) => x.key === k);
    if (!r) {
      console.log(`### ${k}  — NOT FOUND\n`);
      continue;
    }
    console.log(`### ${k}  id=${r.id}  parent=${r.parentSchemeId ?? "-"}  kind=${r.kind}  cluster=${r.clusterTag ?? "-"}  fingerprint=${(r.fingerprint ?? "").slice(0, 12)}`);
    for (const c of r.cqs) {
      console.log(
        `  - ${c.cqKey}  attack=${c.attackType ?? "-"}  scope=${c.targetScope ?? "-"}  text="${(c.text ?? "").slice(0, 70)}"`,
      );
    }
    console.log("");
  }
  await prisma.$disconnect();
}
main();
