/**
 * scripts/seed-walton-cq-fillins.ts
 *
 * Walton CQ catalog audit fill-ins.
 *
 * Round-2 LLM stress-test surfaced that several scheme rows in production
 * had ZERO critical questions registered — most importantly
 * `cause_to_effect` and `sign`. With CQ count = 0 the standing-score path
 * (now band-aided in lib/citations/argumentAttestation.ts) had no
 * dialectical apparatus to score, and dialecticians citing those args
 * had no scaffolded objections to lodge.
 *
 * This script upserts the canonical Walton, Reed & Macagno (2008)
 * critical-question catalog onto those schemes. It is idempotent —
 * uses the schemeId_cqKey composite unique, so re-runs are safe.
 *
 * Sources:
 *   • Walton, Reed & Macagno (2008), "Argumentation Schemes",
 *     Cambridge University Press
 *     - §3.10 Argument from Cause to Effect (CQ1–CQ4)
 *     - §3.5  Argument from Sign (CQ1–CQ3)
 *
 * Usage:
 *   npx tsx scripts/seed-walton-cq-fillins.ts
 *   npx tsx scripts/seed-walton-cq-fillins.ts --dry-run
 */

import { prisma } from "../lib/prismaclient";

type AttackType = "REBUTS" | "UNDERCUTS" | "UNDERMINES";
type TargetScope = "conclusion" | "inference" | "premise";

interface CQ {
  cqKey: string;
  text: string;
  attackType: AttackType;
  targetScope: TargetScope;
}

interface SchemeFillIn {
  schemeKey: string;
  cqs: CQ[];
}

const FILL_INS: SchemeFillIn[] = [
  {
    // Walton, Reed & Macagno (2008), §3.10 — Argument from Cause to Effect.
    // Standard four-CQ form. We add `causal_mechanism` as a fifth CQ
    // following the more recent Walton (2014) elaboration, since "no
    // mechanism" is a defeater dialecticians routinely lodge.
    schemeKey: "cause_to_effect",
    cqs: [
      {
        cqKey: "causal_strength",
        text: "How strong is the causal generalization linking C to E? Are there documented cases where C does not produce E?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "alternative_causes",
        text: "Could a different cause produce the same effect E in this case?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "intervening_factors",
        text: "Are there intervening or confounding factors that could interfere with the causal chain from C to E?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "post_hoc",
        text: "Is the apparent link between C and E merely a post hoc correlation rather than a causal relation?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "causal_mechanism",
        text: "Is there a plausible causal mechanism by which C could bring about E?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
    ],
  },
  {
    // Walton, Reed & Macagno (2008), §3.5 — Argument from Sign.
    // Three canonical CQs.
    schemeKey: "sign",
    cqs: [
      {
        cqKey: "sign_correlation",
        text: "What is the strength of the correlation between the sign and the event/state it is taken to indicate?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "alternative_explanation",
        text: "Are there other events or causes that could account for the presence of the sign?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "sign_observation",
        text: "Has the sign actually been observed reliably in this case?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
    ],
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `Walton CQ fill-in seed (${dryRun ? "DRY RUN" : "WRITE"}): ${FILL_INS.length} scheme(s)`
  );

  for (const fi of FILL_INS) {
    const scheme = await prisma.argumentScheme.findUnique({
      where: { key: fi.schemeKey },
      select: { id: true, key: true, name: true },
    });
    if (!scheme) {
      console.log(`  SKIP: scheme '${fi.schemeKey}' not found in DB`);
      continue;
    }
    const before = await prisma.criticalQuestion.count({
      where: { schemeId: scheme.id },
    });
    console.log(
      `  ${scheme.key} (${scheme.name}) — before: ${before} CQs, target: ${fi.cqs.length}`
    );

    for (const cq of fi.cqs) {
      if (dryRun) {
        console.log(`    [dry] would upsert ${cq.cqKey}`);
        continue;
      }
      await prisma.criticalQuestion.upsert({
        where: {
          schemeId_cqKey: { schemeId: scheme.id, cqKey: cq.cqKey },
        },
        update: {
          text: cq.text,
          attackType: cq.attackType,
          targetScope: cq.targetScope,
          attackKind: cq.attackType,
        },
        create: {
          schemeId: scheme.id,
          cqKey: cq.cqKey,
          text: cq.text,
          attackType: cq.attackType,
          targetScope: cq.targetScope,
          attackKind: cq.attackType,
          status: "OPEN",
        },
      });
    }

    if (!dryRun) {
      const after = await prisma.criticalQuestion.count({
        where: { schemeId: scheme.id },
      });
      console.log(`    after: ${after} CQs`);
    }
  }

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
