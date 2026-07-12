/**
 * scripts/verify-ai-epi-pt3.ts
 *
 * Smoke check for the structural fields added by Track AI-EPI Pt. 3:
 *   1. fitnessBreakdown   on /api/v3/search/arguments?sort=dialectical_fitness
 *      and on the attestation envelope
 *   2. criticalQuestions  aggregate on the attestation envelope
 *   3. standingDepth      on the attestation envelope
 *   4. structuredCitations on the attestation envelope
 *   5. author.kind         present (default HUMAN) on the attestation envelope
 *
 * Asserts that the breakdown components actually sum to the reported total
 * \u2014 i.e. that the score is auditable, not magic.
 *
 * Usage:
 *   tsx scripts/verify-ai-epi-pt3.ts <shortCode>
 *   BASE_URL=http://localhost:3000 tsx scripts/verify-ai-epi-pt3.ts <shortCode>
 *
 * If <shortCode> is omitted, the most recently accessed permalink is used.
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

async function pickShortCode(): Promise<string | null> {
  const cli = process.argv[2];
  if (cli) return cli;
  const row = await prisma.argumentPermalink.findFirst({
    orderBy: [{ lastAccessedAt: "desc" }, { createdAt: "desc" }],
    select: { shortCode: true },
  });
  return row?.shortCode ?? null;
}

function approxEq(a: number, b: number, tol = 1e-3) {
  return Math.abs(a - b) <= tol;
}

async function main() {
  const sc = await pickShortCode();
  if (!sc) {
    console.error("No ArgumentPermalink found. Pass a short code.");
    process.exit(2);
  }
  console.log(`Verifying AI-EPI Pt. 3 surface for /a/${sc}`);
  console.log(`Base URL: ${BASE_URL}`);

  // ===== 1. Search route: fitnessBreakdown =====
  section("1. /api/v3/search/arguments?sort=dialectical_fitness");
  const search = await fetchJson(
    `${BASE_URL}/api/v3/search/arguments?sort=dialectical_fitness&limit=5`,
  );
  assert(search.status === 200, "search returns 200");
  assert(
    search.json && Array.isArray(search.json.results),
    "search payload has results[]",
  );
  assert(
    search.json && typeof search.json.fitnessFormula === "object",
    "search payload exposes fitnessFormula (the weights)",
  );
  const top = search.json?.results?.[0];
  if (top) {
    assert(
      typeof top.dialecticalFitness === "number",
      "first result has numeric dialecticalFitness",
    );
    assert(
      top.fitnessBreakdown && typeof top.fitnessBreakdown === "object",
      "first result has fitnessBreakdown object",
    );
    if (top.fitnessBreakdown) {
      const sum = Object.values(top.fitnessBreakdown.components as any).reduce(
        (acc: number, c: any) => acc + (c?.contribution ?? 0),
        0,
      );
      assert(
        approxEq(sum, top.fitnessBreakdown.total, 1e-3),
        `breakdown components sum to total (sum=${sum.toFixed(3)} total=${top.fitnessBreakdown.total})`,
      );
      assert(
        approxEq(top.fitnessBreakdown.total, top.dialecticalFitness, 1e-3),
        "breakdown total matches the scalar dialecticalFitness",
      );
    }
  } else {
    console.log("  \u26a0 no search results to inspect; skipping per-result assertions");
  }

  // ===== 2. Attestation: new structural fields =====
  section("2. /api/a/:sc/aif?format=attestation");
  const att = await fetchJson(
    `${BASE_URL}/api/a/${sc}/aif?format=attestation`,
  );
  assert(att.status === 200, "attestation returns 200");
  const env = att.json || {};

  // 2a \u2014 fitness breakdown on the envelope
  assert(
    env.fitnessBreakdown && typeof env.fitnessBreakdown === "object",
    "envelope has fitnessBreakdown",
  );
  if (env.fitnessBreakdown) {
    const sum = Object.values(env.fitnessBreakdown.components as any).reduce(
      (acc: number, c: any) => acc + (c?.contribution ?? 0),
      0,
    );
    assert(
      approxEq(sum, env.fitnessBreakdown.total, 1e-3),
      `envelope breakdown sums to total (sum=${sum.toFixed(3)} total=${env.fitnessBreakdown.total})`,
    );
    assert(
      env.fitnessBreakdown.weights &&
        typeof env.fitnessBreakdown.weights.cqAnswered === "number",
      "envelope breakdown carries the formula weights",
    );
  }

  // 2b \u2014 critical-question aggregate
  assert(
    env.criticalQuestions === null ||
      (env.criticalQuestions &&
        Array.isArray(env.criticalQuestions.answered) &&
        Array.isArray(env.criticalQuestions.partiallyAnswered) &&
        Array.isArray(env.criticalQuestions.unanswered)),
    "envelope has criticalQuestions aggregate (or explicit null)",
  );
  if (env.criticalQuestions) {
    const total =
      env.criticalQuestions.answered.length +
      env.criticalQuestions.partiallyAnswered.length +
      env.criticalQuestions.unanswered.length;
    assert(
      total === env.criticalQuestions.total,
      `CQ aggregate buckets sum to total (sum=${total} total=${env.criticalQuestions.total})`,
    );
  }

  // 2c \u2014 standing depth
  const sd = env?.dialecticalStatus?.standingDepth;
  assert(sd && typeof sd === "object", "envelope has dialecticalStatus.standingDepth");
  if (sd) {
    assert(
      typeof sd.challengers === "number" && sd.challengers >= 0,
      `standingDepth.challengers is a non-negative integer (got ${sd.challengers})`,
    );
    assert(
      typeof sd.independentReviewers === "number" && sd.independentReviewers >= 0,
      `standingDepth.independentReviewers is a non-negative integer (got ${sd.independentReviewers})`,
    );
    assert(
      ["thin", "moderate", "dense"].includes(sd.confidence),
      `standingDepth.confidence is one of thin|moderate|dense (got ${sd.confidence})`,
    );
  }

  // 2d \u2014 structured citations
  assert(
    Array.isArray(env.structuredCitations),
    "envelope has structuredCitations: CitationBlock[]",
  );
  if (Array.isArray(env.structuredCitations) && env.structuredCitations.length > 0) {
    const c0 = env.structuredCitations[0];
    assert(
      typeof c0.id === "string" &&
        ("url" in c0) &&
        ("publisher" in c0) &&
        ("quoteAnchor" in c0),
      "first CitationBlock has the canonical shape (id, url, publisher, quoteAnchor)",
    );
  }

  // 2e \u2014 author.kind
  assert(
    env.author === null ||
      (env.author && ["HUMAN", "AI", "HYBRID"].includes(env.author.kind)),
    "envelope has author.kind in {HUMAN, AI, HYBRID} (or author is null)",
  );

  // ===== Summary =====
  console.log(`\n\u2500\u2500 Summary \u2500\u2500`);
  console.log(`  passed: ${passed}`);
  console.log(`  failed: ${failed}`);
  if (failed > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nAll AI-EPI Pt. 3 surface assertions passed \u2705");
}

main()
  .catch((e) => {
    console.error("verify-ai-epi-pt3 fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
