/**
 * Read-only snapshot helper for the `from-existing` spec kind.
 *
 * Queries Prisma for every argument, claim (including premise claims
 * not owned by the deliberation), and scheme referenced by the target
 * deliberation, then returns a `SeededDeliberation`-shaped envelope so
 * the rest of the capture pipeline can stay generic.
 *
 * The returned id maps assign *stable, lexically-sorted, zero-padded
 * sequential* local ids (e.g. `arg-0001`, `arg-0002`, …, `claim-0001`,
 * …). Because `stabilizeReadout` substitutes by string replacement,
 * sorting the source list lexically before assigning local ids is
 * what gives byte-identical re-captures across DB runs (db cuids are
 * lexically stable for a given row).
 *
 * `cleanup` is intentionally a no-op: we do NOT own this data and
 * must never delete it.
 */

import { prisma } from "@/lib/prismaclient";
import type { FromExistingSpec, SeededDeliberation } from "./types";

function padId(prefix: string, idx: number): string {
  return `${prefix}-${String(idx + 1).padStart(4, "0")}`;
}

export async function snapshotExistingDeliberation(
  spec: FromExistingSpec,
): Promise<SeededDeliberation> {
  const { deliberationId } = spec;

  // Verify the deliberation exists; fail fast with a clear error if not.
  const exists = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!exists) {
    throw new Error(
      `from-existing spec "${spec.slug}" references unknown deliberationId=${deliberationId}`,
    );
  }

  const [args, ownedClaims, premiseRows, schemeRows] = await Promise.all([
    prisma.argument.findMany({
      where: { deliberationId },
      select: { id: true },
    }),
    prisma.claim.findMany({
      where: { deliberationId },
      select: { id: true },
    }),
    prisma.argumentPremise.findMany({
      where: { argument: { deliberationId } },
      select: { claimId: true },
    }),
    prisma.argumentSchemeInstance.findMany({
      where: { argument: { deliberationId } },
      select: { schemeId: true, scheme: { select: { key: true } } },
    }),
  ]);

  // Union of owned + premise claim ids so the stabilizer catches both.
  const allClaimIds = new Set<string>();
  for (const c of ownedClaims) allClaimIds.add(c.id);
  for (const p of premiseRows) {
    if (p.claimId) allClaimIds.add(p.claimId);
  }

  // Lexical sort → deterministic local-id assignment across runs.
  const sortedArgIds = args.map((a) => a.id).sort();
  const sortedClaimIds = Array.from(allClaimIds).sort();

  const argumentIds: Record<string, string> = {};
  sortedArgIds.forEach((dbId, i) => {
    argumentIds[padId("arg", i)] = dbId;
  });

  const claimIds: Record<string, string> = {};
  sortedClaimIds.forEach((dbId, i) => {
    claimIds[padId("claim", i)] = dbId;
  });

  // Schemes: prefer the scheme `key` as the local id (it's already
  // stable text like "expert-opinion"). Dedupe by schemeId.
  const schemeIds: Record<string, string> = {};
  const seenSchemeIds = new Set<string>();
  for (const row of schemeRows) {
    if (!row.schemeId || seenSchemeIds.has(row.schemeId)) continue;
    seenSchemeIds.add(row.schemeId);
    const key = row.scheme?.key ?? `unknown-${row.schemeId}`;
    schemeIds[key] = row.schemeId;
  }

  return {
    deliberationId,
    argumentIds,
    claimIds,
    schemeIds,
    cleanup: async () => {
      // No-op: from-existing snapshots are read-only.
    },
  };
}
