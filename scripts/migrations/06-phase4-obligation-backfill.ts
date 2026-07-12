// scripts/migrations/06-phase4-obligation-backfill.ts
//
// Phase 4 / Spec 3 §5 phase-3a step 2 — for every existing
// SchemeInstance (open or not), create a CqObligationRecord with
// status='not-offered' for every CQ in the scheme's bundle. Idempotent.
//
// Dry-run by default. Pass --apply to commit.
//
// Run:
//   npx tsx --env-file=.env scripts/migrations/06-phase4-obligation-backfill.ts
//   npx tsx --env-file=.env scripts/migrations/06-phase4-obligation-backfill.ts --apply

import { prisma } from "@/lib/prismaclient";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`mode: ${apply ? "APPLY" : "DRY-RUN"}`);

  const instances = await prisma.schemeInstance.findMany({
    select: {
      id: true,
      schemeId: true,
      status: true,
      scheme: {
        select: {
          key: true,
          cqs: {
            where: { instanceId: null },
            select: {
              cqKey: true,
              burdenOfProof: true,
              requiresEvidence: true,
              premiseType: true,
            },
          },
        },
      },
      obligations: { select: { cqKey: true } },
    },
  });

  console.log(`scanned ${instances.length} SchemeInstance row(s)`);

  let toCreate = 0;
  let instancesTouched = 0;
  const perScheme: Record<string, number> = {};

  for (const inst of instances) {
    const existing = new Set(inst.obligations.map((o) => o.cqKey));
    const missing = (inst.scheme.cqs ?? []).filter(
      (cq) => cq.cqKey && !existing.has(cq.cqKey)
    );
    if (missing.length === 0) continue;
    instancesTouched += 1;
    toCreate += missing.length;
    perScheme[inst.scheme.key ?? "unknown"] =
      (perScheme[inst.scheme.key ?? "unknown"] ?? 0) + missing.length;

    if (apply) {
      await prisma.cqObligationRecord.createMany({
        data: missing.map((cq) => ({
          instanceId: inst.id,
          cqKey: cq.cqKey!,
          status: "not-offered",
          burdenOfProof: cq.burdenOfProof,
          requiresEvidence: cq.requiresEvidence,
          premiseType: cq.premiseType,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`---`);
  console.log(`instances touched : ${instancesTouched}`);
  console.log(`rows to create    : ${toCreate}`);
  console.log(`by scheme         :`);
  for (const [k, n] of Object.entries(perScheme).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${n}`);
  }

  if (!apply) {
    console.log(`\n(dry-run — pass --apply to commit)`);
  } else {
    console.log(`\nDONE`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
