/**
 * scripts/verify-b-lineage-smoke.ts
 *
 * verify-mode-B v2 — Tier-1 smoke test for shared-root / convergent-lineage
 * detection (C5, the flagship). Runs the exact per-URL pipeline the
 * /api/verify/lineage route runs (resolve → fetch → extract upstream signals →
 * union-find) on a set of source URLs, with no server, auth, or extension.
 *
 * The real demo: pass several article URLs that cover the SAME story —
 *   npx tsx scripts/verify-b-lineage-smoke.ts <url1> <url2> <url3> …
 * and watch the ones that cite the same study / carry the same wire / link the
 * same press release collapse into one lineage. With no args it runs an
 * illustrative default (convergence depends on live page content).
 *
 * Needs outbound network.
 */

import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { fetchUpstreams, clusterByUpstream, type SourceWithUpstream } from "@/lib/verify/lineage";

const DEMO = [
  "https://en.wikipedia.org/wiki/Citogenesis",
  "https://en.wikipedia.org/wiki/Circular_reporting",
];

async function toSource(url: string): Promise<SourceWithUpstream> {
  let canonical = url;
  let ownDoi: string | undefined;
  let title: string | null = null;
  try {
    const rc = await resolveUrlToCitation(url);
    canonical = rc.canonicalUrl || url;
    ownDoi = rc.doi ?? rc.derivedIdentifiers?.doi ?? undefined;
    title = rc.source?.title ?? null;
  } catch {
    /* soft-fail; still fetch upstreams from the raw URL */
  }
  const upstreams = await fetchUpstreams(canonical, { ownDoi });
  return { id: url, url, title, upstreams };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const urls = args.length > 0 ? args : DEMO;
  console.log(`Extracting upstream signals for ${urls.length} source${urls.length === 1 ? "" : "s"}…`);

  const sources: SourceWithUpstream[] = [];
  for (const url of urls) {
    process.stdout.write(`  ${url} … `);
    const s = await toSource(url);
    const kinds = s.upstreams.map((u) => u.label);
    console.log(kinds.length ? kinds.join(", ") : "(no upstream signal)");
    sources.push(s);
  }

  const r = clusterByUpstream(sources);
  console.log("\n" + "─".repeat(64));
  console.log(`  ${r.headline}${r.convergent.length ? "   ← shared lineage detected" : ""}`);
  console.log("─".repeat(64));

  for (const lineage of r.convergent) {
    console.log(`\n  ⇢ ${lineage.members.length} sources share a root:`);
    for (const u of lineage.sharedUpstreams) console.log(`      root [${u.kind}] ${u.label}`);
    for (const m of lineage.members) console.log(`      · ${m.url}`);
  }
  if (r.convergent.length === 0) {
    console.log(`\n  No shared upstream found among these sources.`);
  }
  if (r.noUpstream) {
    console.log(`\n  ${r.noUpstream} source(s) had no extractable upstream signal.`);
  }

  console.log(
    "\n  note: reports shared roots we could identify (cited DOI / wire / press release).",
  );
  console.log("        Absence of convergence is NOT evidence of independence — this is heuristic, not proof.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
