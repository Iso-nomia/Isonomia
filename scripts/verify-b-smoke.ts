/**
 * scripts/verify-b-smoke.ts
 *
 * verify-mode-B v0 — Tier-1 smoke test. Exercises the real pipeline
 * (resolveUrlToCitation → clusterConvergence) on real URLs, with no server,
 * auth, Upstash, or extension in the way. If this works, the substance of v0
 * works; the endpoint and panel are just plumbing on top.
 *
 * Usage:
 *   npx tsx scripts/verify-b-smoke.ts                 # runs the built-in demo set
 *   npx tsx scripts/verify-b-smoke.ts <url> <url> …   # your own URLs
 *
 * Needs outbound network (Crossref / arXiv / OpenAlex / publisher fetches).
 * Exits 0 always — this is a smoke test, it reports, it doesn't assert.
 */

import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { clusterConvergence, type ResolvedRef, type ConvergenceResult } from "@/lib/verify/convergence";

// A DOI reached two ways (should collapse to one root) + one unrelated article.
// Expected: "3 tellings → 2 roots", one 2× cluster keyed by the shared DOI.
const DEMO_URLS = [
  "https://doi.org/10.1371/journal.pone.0313362",
  "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0313362",
  "https://en.wikipedia.org/wiki/Citogenesis",
];

/** Same URL→ResolvedRef mapping the /api/verify/resolve route uses. */
async function toRef(url: string): Promise<ResolvedRef> {
  try {
    const rc = await resolveUrlToCitation(url);
    let domain: string | null = null;
    try {
      domain = new URL(rc.canonicalUrl || url).hostname;
    } catch {
      /* leave null */
    }
    return {
      inputUrl: url,
      canonicalUrl: rc.canonicalUrl || "",
      doi: rc.doi ?? rc.derivedIdentifiers?.doi ?? null,
      domain,
      title: rc.source?.title ?? null,
      confidence: rc.confidence,
    };
  } catch (err) {
    let domain: string | null = null;
    try {
      domain = new URL(url).hostname;
    } catch {
      /* leave null */
    }
    console.error(`  ! resolve failed for ${url}: ${(err as Error)?.message ?? err}`);
    return { inputUrl: url, canonicalUrl: url, doi: null, domain, title: null, confidence: "none" };
  }
}

function printResult(result: ConvergenceResult): void {
  console.log("\n" + "─".repeat(60));
  console.log(`  ${result.headline}${result.convergent ? "   ← convergence detected" : ""}`);
  console.log("─".repeat(60));

  for (const c of result.clusters) {
    const tag = c.rootKind === "doi" ? `DOI ${c.rootLabel}` : c.rootLabel;
    const marker = c.members.length > 1 ? `⇢ ${c.members.length}× SAME SOURCE` : "  1×";
    console.log(`\n  ${marker}  [${tag}]`);
    for (const m of c.members) {
      const conf = m.confidence && m.confidence !== "high" ? ` (${m.confidence})` : "";
      console.log(`      · ${m.inputUrl}${conf}`);
    }
  }

  if (result.unresolved.length) {
    console.log(`\n  ${result.unresolved.length} unresolved (no identity):`);
    for (const u of result.unresolved) console.log(`      · ${u.inputUrl}`);
  }

  console.log(
    "\n  note: v0 catches same-source-via-multiple-URLs (shared DOI / same canonical URL).",
  );
  console.log(
    "        It does NOT detect distinct articles sharing an upstream — that is v2.",
  );
  console.log("        Absence of convergence is not evidence of independence.\n");
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  const targets = urls.length > 0 ? urls : DEMO_URLS;
  console.log(`Resolving ${targets.length} URL${targets.length === 1 ? "" : "s"}…`);

  const refs: ResolvedRef[] = [];
  for (const url of targets) {
    process.stdout.write(`  resolving ${url} … `);
    const ref = await toRef(url);
    console.log(ref.doi ? `doi:${ref.doi}` : ref.canonicalUrl || "(no canonical url)");
    refs.push(ref);
  }

  printResult(clusterConvergence(refs));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
