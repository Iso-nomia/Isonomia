/**
 * Phase 4.2 — PA-node demo seed.
 *
 * Builds a minimal deliberation that demonstrates the preference → standing flip
 * end-to-end on real DB data: two arguments with contradictory conclusions that
 * mutually rebut (CLAIM-level conflicts, so the contrary lands between the
 * conclusion texts — see __tests__/aspic/deliberation-evaluation.test.ts), then
 * adds a PreferenceApplication and shows grounded standing change from
 * undecided → in/out.
 *
 * Run: tsx --env-file=.env scripts/seed-preference-demo.ts
 * (Read-only-safe to re-run: each run creates a fresh demo deliberation.)
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prismaclient";
import { getArgumentDefeats } from "@/lib/aspic/deliberationEvaluation";

async function main() {
  const run = randomUUID().slice(0, 8);
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error("No user found — seed a user first.");
  const by = user.id;

  const delib = await prisma.deliberation.create({
    data: { hostType: "free", hostId: by, createdById: by },
    select: { id: true },
  });
  const deliberationId = delib.id;
  console.log(`\nDeliberation ${deliberationId} (run ${run})`);

  const claim = (text: string) =>
    prisma.claim.create({
      data: { text, createdById: by, moid: `pref-demo-${run}-${randomUUID().slice(0, 8)}`, deliberationId },
      select: { id: true },
    });

  // Conclusions (contradictory) + a premise per argument.
  const [cC, cD, pA, pB] = await Promise.all([claim("c"), claim("¬c"), claim("p"), claim("q")]);

  const mkArg = async (conclusionClaimId: string, premiseClaimId: string, text: string) => {
    const a = await prisma.argument.create({
      data: { deliberationId, authorId: by, text, conclusionClaimId },
      select: { id: true },
    });
    await prisma.argumentPremise.create({ data: { argumentId: a.id, claimId: premiseClaimId, isImplicit: false } });
    return a.id;
  };
  const argA = await mkArg(cC.id, pA.id, "p, therefore c");
  const argB = await mkArg(cD.id, pB.id, "q, therefore ¬c");

  // Mutual rebut — claim-level conflicts in both directions.
  await prisma.conflictApplication.createMany({
    data: [
      { deliberationId, createdById: by, conflictingClaimId: cC.id, conflictedClaimId: cD.id, aspicAttackType: "rebutting", legacyAttackType: "REBUTS" },
      { deliberationId, createdById: by, conflictingClaimId: cD.id, conflictedClaimId: cC.id, aspicAttackType: "rebutting", legacyAttackType: "REBUTS" },
    ],
  });

  const show = async (label: string) => {
    const a = await getArgumentDefeats(deliberationId, argA);
    const b = await getArgumentDefeats(deliberationId, argB);
    console.log(`  ${label}: argA=${a.standing.status} (pref ${a.standing.preferenceApplied}), argB=${b.standing.status}`);
  };

  console.log("Standing:");
  await show("before preference");

  // Preference: argA > argB.
  await prisma.preferenceApplication.create({
    data: { deliberationId, createdById: by, preferredArgumentId: argA, dispreferredArgumentId: argB },
  });
  await show("after  preference");
  console.log("\nExpected: before → undec/undec; after → in/out (argA preferred).\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
