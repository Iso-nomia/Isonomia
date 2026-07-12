/**
 * Spec 4 phase 4a — Phase 2 step 9 invariant checker (CI/cron).
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md
 *
 * Exits 0 if every invariant holds, non-zero otherwise. Designed to be wired
 * into CI (or a pre-deploy hook) so behaviour-fingerprint drift is caught
 * before code reaches production. The Jest suite globally mocks the Prisma
 * client (`jest.setup.ts`), so this lives as a standalone script instead.
 *
 * Invariants checked:
 *   1. Every `kind='argument-scheme'` row has a non-NULL `fingerprint`.
 *   2. Stored fingerprints agree with what `computeBehaviourFingerprint`
 *      computes today (drift detector — algorithm change ⇒ re-run
 *      scripts/migrations/04-phase2-fingerprint-materialize.ts).
 *   3. No two argument-scheme rows share a fingerprint (also enforced by
 *      the partial unique index ArgumentScheme_argument_scheme_fingerprint_unique
 *      at the DB level; this surfaces it in CI output earlier).
 *
 * Run:
 *   npx tsx --env-file=.env scripts/audits/verify-fingerprint-invariant.ts
 */

import { prisma } from "@/lib/prismaclient";
import { computeBehaviourFingerprint } from "@/lib/schemes/verifier";

type Row = {
  id: string;
  key: string;
  kind: string;
  fingerprint: string | null;
  premises: unknown;
  conclusion: unknown;
  epistemicMode: string | null;
  cqs: Array<{ cqKey: string | null; attackType: string | null; targetScope: string | null }>;
};

async function main(): Promise<void> {
  console.log("=== Phase 2 step 9 — fingerprint invariant check ===");
  const rows = (await prisma.argumentScheme.findMany({
    where: { kind: "argument-scheme" } as any,
    include: { cqs: true },
  })) as unknown as Row[];
  console.log(`loaded ${rows.length} kind='argument-scheme' row(s)`);

  // Invariant 1: no NULL fingerprints.
  const nulls = rows.filter((r) => r.fingerprint === null).map((r) => r.key);
  // Invariant 2: stored fingerprints match computed.
  const drift = rows
    .map((r) => ({ key: r.key, stored: r.fingerprint, computed: computeBehaviourFingerprint(r as any) }))
    .filter((x) => x.stored !== x.computed);
  // Invariant 3: no duplicates among populated values.
  const byFp = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.fingerprint) continue;
    if (!byFp.has(r.fingerprint)) byFp.set(r.fingerprint, []);
    byFp.get(r.fingerprint)!.push(r.key);
  }
  const collisions = [...byFp.entries()].filter(([, keys]) => keys.length > 1);

  const violations: string[] = [];
  console.log(
    `[1] non-NULL fingerprint: ${nulls.length === 0 ? "PASS" : `FAIL (${nulls.length})`}`,
  );
  if (nulls.length > 0) {
    for (const k of nulls) console.log(`    NULL: ${k}`);
    violations.push("null-fingerprints");
  }

  console.log(`[2] stored == computed: ${drift.length === 0 ? "PASS" : `FAIL (${drift.length})`}`);
  if (drift.length > 0) {
    for (const d of drift) {
      console.log(`    drift: ${d.key}  stored=${(d.stored ?? "NULL").slice(0, 16)}…  computed=${d.computed.slice(0, 16)}…`);
    }
    violations.push("fingerprint-drift");
  }

  console.log(
    `[3] no fingerprint collisions: ${collisions.length === 0 ? "PASS" : `FAIL (${collisions.length})`}`,
  );
  if (collisions.length > 0) {
    for (const [fp, keys] of collisions) {
      console.log(`    collision: ${fp.slice(0, 16)}…  ${keys.join(", ")}`);
    }
    violations.push("fingerprint-collisions");
  }

  await prisma.$disconnect();

  if (violations.length > 0) {
    console.error(`\n=== FAIL — invariant(s) violated: ${violations.join(", ")} ===`);
    process.exit(1);
  }
  console.log("\n=== PASS — all invariants hold ===");
}

main().catch(async (e) => {
  console.error("[verify-fingerprint-invariant] failed:", e);
  await prisma.$disconnect();
  process.exit(2);
});
