// scripts/migrations/07-phase4-premise-type-backfill.ts
//
// Phase 4 step 15 / Spec 3 phase 3d — Carneades `premiseType` rollout.
//
// Per Walton (2008) §11.1, every CQ in an argumentation scheme is an
// ORDINARY premise unless explicitly marked ASSUMPTION (presumed true
// until questioned) or EXCEPTION (challenger must establish). Q-018
// audit confirmed that no anti-rigid schemes exist in the current
// catalogue, so the EXCEPTION case is empirically void. Defaulting
// all null premiseType to ORDINARY is safe and spec-conformant.
//
// Dry-run by default. Pass --apply to commit.

import { prisma } from "@/lib/prismaclient";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`mode: ${apply ? "APPLY" : "DRY-RUN"}`);

  const before = await prisma.criticalQuestion.groupBy({
    by: ["premiseType"],
    _count: { _all: true },
    where: { instanceId: null, schemeId: { not: null } },
  });
  console.log(`before:`);
  for (const g of before) {
    console.log(`  ${String(g.premiseType ?? "null").padEnd(12)} ${g._count._all}`);
  }

  const toUpdate = await prisma.criticalQuestion.count({
    where: { instanceId: null, schemeId: { not: null }, premiseType: null },
  });
  console.log(`---\nrows to update -> ORDINARY: ${toUpdate}`);

  if (!apply) {
    console.log(`\n(dry-run — pass --apply to commit)`);
    return;
  }

  const result = await prisma.criticalQuestion.updateMany({
    where: { instanceId: null, schemeId: { not: null }, premiseType: null },
    data: { premiseType: "ORDINARY" },
  });
  console.log(`updated: ${result.count}`);

  const after = await prisma.criticalQuestion.groupBy({
    by: ["premiseType"],
    _count: { _all: true },
    where: { instanceId: null, schemeId: { not: null } },
  });
  console.log(`after:`);
  for (const g of after) {
    console.log(`  ${String(g.premiseType ?? "null").padEnd(12)} ${g._count._all}`);
  }
  console.log(`\nDONE`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
