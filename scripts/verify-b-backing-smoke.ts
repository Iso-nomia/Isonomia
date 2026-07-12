/**
 * scripts/verify-b-backing-smoke.ts
 *
 * verify-mode-B v1b — Tier-1 smoke test for the hollow-citation (C4) backing check.
 * Runs the exact per-pair pipeline the /api/verify/backing route runs (resolve →
 * fetch source body text / abstract → LLM-judge → shapeVerdict) on one or a few
 * {claim, url} pairs, with no server, auth, or extension. Lets you eyeball judge
 * quality and see the honest states (backs / contradicts / unrelated / unverifiable).
 *
 * Usage:
 *   npx tsx scripts/verify-b-backing-smoke.ts                       # built-in demo
 *   npx tsx scripts/verify-b-backing-smoke.ts "<claim>" "<url>"     # your own pair
 *
 * Needs outbound network. The judge step needs OPENAI_API_KEY — without it the
 * pipeline still resolves + fetches, and reports the verdict as `unverifiable`.
 */

import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { fetchSourceText } from "@/lib/verify/sourceText";
import { assessBacking, shapeVerdict, type SourceKind } from "@/lib/verify/backing";

interface Pair {
  claim: string;
  citedUrl: string;
}

// A claim the source backs, and a hollow one citing the same source.
const DEMO: Pair[] = [
  {
    claim: "Citogenesis describes how an unsourced statement can become citable through circular reporting.",
    citedUrl: "https://en.wikipedia.org/wiki/Citogenesis",
  },
  {
    claim: "The Eiffel Tower is 330 metres tall.",
    citedUrl: "https://en.wikipedia.org/wiki/Citogenesis",
  },
];

async function checkPair(pair: Pair): Promise<void> {
  console.log("\n" + "─".repeat(64));
  console.log(`  CLAIM: ${pair.claim}`);
  console.log(`  CITES: ${pair.citedUrl}`);

  // Resolve (reuse the v0 resolver; no DB writes).
  let canonicalUrl = pair.citedUrl;
  let abstract: string | undefined;
  try {
    const rc = await resolveUrlToCitation(pair.citedUrl);
    canonicalUrl = rc.canonicalUrl || pair.citedUrl;
    abstract = rc.source?.abstractText || undefined;
  } catch (err) {
    console.log(`  (resolve soft-failed: ${(err as Error)?.message ?? err})`);
  }

  // Prefer body text; fall back to abstract; else none.
  let sourceText = "";
  let sourceKind: SourceKind = "none";
  const body = await fetchSourceText(canonicalUrl);
  if (body.ok) {
    sourceText = body.text;
    sourceKind = "body";
  } else if (abstract && abstract.trim().length >= 80) {
    sourceText = abstract.trim();
    sourceKind = "abstract";
  }
  console.log(`  SOURCE: ${sourceKind}${sourceKind !== "none" ? ` (${sourceText.length} chars)` : " — no retrievable text"}`);

  // Judge (needs OPENAI_API_KEY; failure → unverifiable, not a false "unsupported").
  let assessment = null;
  if (sourceKind !== "none") {
    try {
      assessment = await assessBacking({ sourceText, claim: pair.claim });
    } catch (err) {
      console.log(`  (judge unavailable: ${(err as Error)?.message ?? err})`);
    }
  }

  const v = shapeVerdict(assessment, sourceKind);
  const pct = v.status === "unverifiable" ? "" : `  (${Math.round(v.confidence * 100)}% confidence)`;
  console.log(`  VERDICT: ${v.status.toUpperCase()}${pct}`);
  if (v.rationale) console.log(`           ${v.rationale}`);
  if (v.note) console.log(`           note: ${v.note}`);
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠  OPENAI_API_KEY not set — resolve + fetch will run, but the judge won't (verdicts → unverifiable).\n");
  }
  const [, , claimArg, urlArg] = process.argv;
  const pairs = claimArg && urlArg ? [{ claim: claimArg, citedUrl: urlArg }] : DEMO;

  console.log(`Backing check on ${pairs.length} pair${pairs.length === 1 ? "" : "s"}…`);
  for (const pair of pairs) await checkPair(pair);

  console.log(
    "\n  note: 'unrelated' is the hollow-citation flag (source doesn't back the claim);",
  );
  console.log("        'unverifiable' means the source text couldn't be judged — not that the claim is unsupported.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
