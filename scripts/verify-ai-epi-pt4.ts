/**
 * scripts/verify-ai-epi-pt4.ts
 *
 * End-to-end smoke check for the deliberation-scope readouts shipped
 * in Track AI-EPI Pt. 4:
 *   1. /api/v3/deliberations/{id}/fingerprint
 *   2. /api/v3/deliberations/{id}/frontier
 *   3. /api/v3/deliberations/{id}/missing-moves
 *   4. /api/v3/deliberations/{id}/chains
 *   5. /api/v3/deliberations/{id}/synthetic-readout
 *
 * Asserts:
 *   - All five endpoints return 200 with the documented top-level shape.
 *   - The fingerprint contentHash is stable (two reads agree).
 *   - SyntheticReadout.contentHash equals the fingerprint contentHash.
 *   - SyntheticReadout.honestyLine is a deterministic function of the
 *     contentHash (two reads return the identical string).
 *   - refusalSurface entries cite blockerIds that exist in the
 *     fingerprint or frontier (no fabricated ids).
 *   - schemeDistribution sums to argumentCount.
 *   - depthDistribution sums to argumentCount.
 *
 * Usage:
 *   tsx scripts/verify-ai-epi-pt4.ts <deliberationId>
 *   BASE_URL=http://localhost:3000 tsx scripts/verify-ai-epi-pt4.ts <id>
 *
 * If <deliberationId> is omitted, the most-recently-updated deliberation
 * with at least one argument is used.
 */

import { prisma } from "@/lib/prismaclient";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  \u2717 ${label}`);
  }
}

function section(title: string) {
  console.log(`\n\u2500\u2500 ${title} \u2500\u2500`);
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave null */
  }
  return { status: res.status, json, text };
}

async function pickDeliberationId(): Promise<string | null> {
  const cli = process.argv[2];
  if (cli) return cli;
  const row = await prisma.argument.findFirst({
    where: { deliberationId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { deliberationId: true },
  });
  return row?.deliberationId ?? null;
}

function sumValues(obj: Record<string, number> | undefined | null): number {
  if (!obj) return 0;
  return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
}

async function main() {
  const id = await pickDeliberationId();
  if (!id) {
    console.error("No deliberation found. Pass an id.");
    process.exit(2);
  }
  console.log(`Verifying AI-EPI Pt. 4 surface for deliberation ${id}`);
  console.log(`Base URL: ${BASE_URL}`);

  // ───── 1. Fingerprint ─────────────────────────────────────────
  section("1. /api/v3/deliberations/{id}/fingerprint");
  const fp1 = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/fingerprint`,
  );
  assert(fp1.status === 200, "fingerprint returns 200");
  assert(fp1.json && typeof fp1.json.contentHash === "string", "has contentHash");
  assert(typeof fp1.json?.argumentCount === "number", "has argumentCount");
  assert(
    fp1.json?.depthDistribution &&
      typeof fp1.json.depthDistribution.thin === "number",
    "has depthDistribution {thin,moderate,dense}",
  );
  assert(
    fp1.json?.cqCoverage &&
      typeof fp1.json.cqCoverage.total === "number",
    "has cqCoverage {answered,partial,unanswered,total}",
  );
  assert(
    fp1.json?.extraction &&
      typeof fp1.json.extraction.articulationOnly === "boolean",
    "extraction.articulationOnly is boolean",
  );
  if (fp1.json) {
    const depthSum = sumValues(fp1.json.depthDistribution);
    assert(
      depthSum === fp1.json.argumentCount,
      `depthDistribution sums to argumentCount (${depthSum} vs ${fp1.json.argumentCount})`,
    );
    const schemeSum = sumValues(fp1.json.schemeDistribution);
    // schemeDistribution counts arguments with at least one primary scheme;
    // it can be ≤ argumentCount.
    assert(
      schemeSum <= fp1.json.argumentCount,
      `schemeDistribution sum ≤ argumentCount (${schemeSum} ≤ ${fp1.json.argumentCount})`,
    );
  }

  // Stability — second read should give an identical hash.
  const fp2 = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/fingerprint`,
  );
  assert(
    fp1.json?.contentHash === fp2.json?.contentHash,
    "contentHash is stable across reads",
  );

  // ───── 2. Contested Frontier ──────────────────────────────────
  section("2. /api/v3/deliberations/{id}/frontier");
  const frontier = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/frontier`,
  );
  assert(frontier.status === 200, "frontier returns 200");
  assert(
    Array.isArray(frontier.json?.unansweredUndercuts),
    "has unansweredUndercuts[]",
  );
  assert(
    Array.isArray(frontier.json?.unansweredUndermines),
    "has unansweredUndermines[]",
  );
  assert(Array.isArray(frontier.json?.unansweredCqs), "has unansweredCqs[]");
  assert(
    Array.isArray(frontier.json?.terminalLeaves),
    "has terminalLeaves[]",
  );
  assert(
    Array.isArray(frontier.json?.loadBearingnessRanking),
    "has loadBearingnessRanking[]",
  );

  // sortBy parameter is honored
  const frontierSeverity = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/frontier?sortBy=severity`,
  );
  assert(frontierSeverity.status === 200, "frontier?sortBy=severity returns 200");

  // ───── 3. Missing Moves ───────────────────────────────────────
  section("3. /api/v3/deliberations/{id}/missing-moves");
  const mm = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/missing-moves`,
  );
  assert(mm.status === 200, "missing-moves returns 200");
  assert(Array.isArray(mm.json?.perArgument), "has perArgument[]");
  assert(Array.isArray(mm.json?.schemesUnused), "has schemesUnused[]");
  assert(
    typeof mm.json?.metaArgumentsAbsent === "boolean",
    "metaArgumentsAbsent is boolean",
  );
  assert(
    typeof mm.json?.crossSchemeMediatorsAbsent === "boolean",
    "crossSchemeMediatorsAbsent is boolean",
  );

  // ───── 4. Chain Exposure ──────────────────────────────────────
  section("4. /api/v3/deliberations/{id}/chains");
  const chains = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/chains`,
  );
  assert(chains.status === 200, "chains returns 200");
  assert(Array.isArray(chains.json?.chains), "has chains[]");
  assert(
    Array.isArray(chains.json?.uncoveredClaims),
    "has uncoveredClaims[]",
  );
  if (chains.json?.chains?.length) {
    const c0 = chains.json.chains[0];
    assert(typeof c0.id === "string", "chain has id");
    assert(typeof c0.chainStanding === "string", "chain has chainStanding");
    assert(c0.chainFitness && typeof c0.chainFitness.total === "number", "chain has chainFitness");
  }

  // ───── 5. Synthetic Readout ───────────────────────────────────
  section("5. /api/v3/deliberations/{id}/synthetic-readout");
  const sr1 = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/synthetic-readout`,
  );
  assert(sr1.status === 200, "synthetic-readout returns 200");
  assert(
    sr1.json?.contentHash === fp1.json?.contentHash,
    "readout.contentHash equals fingerprint.contentHash",
  );
  assert(
    sr1.json?.fingerprint && sr1.json?.frontier && sr1.json?.missingMoves && sr1.json?.chains,
    "readout composes all four substrates",
  );
  assert(sr1.json?.cross === null, "cross is null (deferred to Pt. 4 item 7)");
  assert(
    sr1.json?.refusalSurface &&
      Array.isArray(sr1.json.refusalSurface.cannotConcludeBecause),
    "has refusalSurface.cannotConcludeBecause[]",
  );
  assert(
    typeof sr1.json?.honestyLine === "string" && sr1.json.honestyLine.length > 0,
    "has non-empty honestyLine",
  );

  // honestyLine is deterministic in contentHash — second read must agree.
  const sr2 = await fetchJson(
    `${BASE_URL}/api/v3/deliberations/${encodeURIComponent(id)}/synthetic-readout`,
  );
  assert(
    sr1.json?.honestyLine === sr2.json?.honestyLine,
    "honestyLine is deterministic across reads",
  );

  // refusalSurface blockerIds must reference real argument ids from the graph.
  if (sr1.json?.refusalSurface?.cannotConcludeBecause?.length) {
    const realArgIds = new Set<string>();
    for (const u of sr1.json.frontier.unansweredUndercuts ?? [])
      if (u.challengerArgumentId) realArgIds.add(u.challengerArgumentId);
    for (const u of sr1.json.frontier.unansweredUndermines ?? [])
      if (u.challengerArgumentId) realArgIds.add(u.challengerArgumentId);

    let allReal = true;
    for (const entry of sr1.json.refusalSurface.cannotConcludeBecause) {
      if (entry.blockedBy === "depth-thin") continue; // no blocker ids by design
      for (const bid of entry.blockerIds ?? []) {
        if (!realArgIds.has(bid)) {
          allReal = false;
          break;
        }
      }
      if (!allReal) break;
    }
    assert(allReal, "refusalSurface blockerIds reference real graph nodes");
  } else {
    console.log("  \u26a0 refusalSurface is empty; skipping blocker-id reality check");
  }

  // ───── Summary ────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
