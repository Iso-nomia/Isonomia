/**
 * experiments/R-blind-spot/generate-items.ts
 *
 * Item-bank builder for the R pilot. Generates (premise, cited-source) pairs of
 * the three item types with an LLM, because the threat model is errors that
 * live in LLM-plausibility space — so we sample them from an LLM.
 *
 * Generator family = GPT (invariant 3: must differ from the same-family panel,
 * which is Claude, or the panel would catch its own generation tells).
 *
 * KNOWN PILOT CONFOUND (§4 of the protocol): GPT also sits in the cross-family
 * panel, so a cross-family GPT checker could catch its own tells and inflate the
 * cross-family arm. The full run fixes this by CROSSING generator family with
 * panel family (generate from both Claude and GPT and read the interaction).
 * The pilot accepts the confound to de-risk the harness; the analyzer flags it.
 *
 * MATCHED-PAIR DESIGN (adopted after the first pilot bank): the original prompt
 * only told the plausible_correlated items to carry explicit study durations and
 * correlational framing, so those surface features leaked the item type (~90% of
 * plausible abstracts named a short window vs 0% of clean). A checker could then
 * shortcut "short duration → overclaim" without reasoning, diluting the
 * measurement and biasing R toward a false "no gap". The fix holds item
 * DIFFICULTY constant by construction: the clean_correct and plausible_correlated
 * items are generated as PAIRS around ONE shared source (`generatePairs`), so the
 * only thing that varies between a clean item and its twin is whether the premise
 * matches or overclaims that identical source — no surface feature can predict
 * the type. `auditSurfaceMatch` still runs as a regression guard, and
 * `auditPairing` confirms every twin actually shares its source. obvious_error
 * (the floor) is generated separately but with the same surface concreteness.
 * (For AI panels each checker sees one item in a fresh context, so a shared
 * source never leaks; the panel shuffle should keep paired items apart for the
 * human arm.)
 *
 * Output is UNLABELLED (`groundTruthError: null`): the ground truth is set by the
 * HUMAN FILTER pass (make-filter-sheet.ts → apply-filter.ts), never the
 * generator — that is what turns "generated to look wrong" into ground truth on
 * which items are genuinely wrong-but-plausible.
 *
 *   Run:  tsx --env-file=.env experiments/R-blind-spot/generate-items.ts --per-type 30
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { GptClient, MODELS } from "./clients";
import { extractJson } from "./judge";
import type { Item, ItemType, SourceLite } from "./types";

const DATA_DIR = join(__dirname, "data");

// The measurement pair (clean_correct + plausible_correlated) is generated
// TOGETHER around one shared source, so item difficulty is identical for both
// and the only variable is whether the premise matches or overclaims. This is
// the strong design that replaced surface-distribution matching.
const PAIR_SYSTEM = `You generate MATCHED PAIRS for an evidence-fidelity benchmark. Each pair is ONE fictional cited source (title, authors, year, abstract, key findings) plus TWO premises about that SAME source:

- "cleanPremise" — a premise the source GENUINELY and clearly supports. It matches the source on population, outcome, study scope/duration, and strength of claim: if the source is correlational the premise says "is associated with" (NOT "causes"); if the study is short the premise makes NO long-term/permanent claim; if the source measures a biomarker the premise is about that biomarker.
- "overclaimPremise" — a premise that READS as supported on a fast pass but OVERCLAIMS on EXACTLY ONE dimension relative to the SAME source. Same topic as cleanPremise; it differs ONLY in that one dimension.

Because both premises cite the identical source, the source's readability, specificity, and difficulty are held constant — the ONLY thing that varies is whether the premise matches the evidence. That is the entire point; do not make the two premises differ in length, tone, confidence, or specificity.

Pick the overclaim dimension per pair and ROTATE it across pairs (use all five roughly evenly):
  (a) population/sample — the premise's subjects differ from the study population (adults vs rats/adolescents);
  (b) correlation-as-causation — the source reports an association; the premise asserts causation;
  (c) proxy/surrogate outcome — the source measures a related but DISTINCT outcome; the premise claims the target/clinical result;
  (d) magnitude/dose/duration — the source shows a small or short-term effect; the premise claims a large or long-term one;
  (e) scope generalisation — the source's result holds in one narrow condition/subgroup; the premise states it universally.

HARD CONSTRAINTS (the gap must need DOMAIN REASONING, never word-spotting):
  - The abstract sounds confident and on-topic and does NOT announce its own limitation — no "modest/mixed/varies/however/remains unclear/under review/subjective". The SAME abstract serves both premises.
  - The KEY FINDINGS also read as supportive — never state a limitation aloud ("no causation established", "limited to the trial duration", "not significant").
  - The overclaimPremise must NOT be self-evidently absolute — no "completely eliminates/guarantees/prevents all/ensures/permanent/100%/always/universally". It is a NORMAL confident claim whose wrongness is invisible WITHOUT checking the source.
  - EVERY abstract states a study design AND an explicit study window, drawn from a MIX across pairs — some SHORT (8-week, three-month) and some LONG (10-year cohort, longitudinal). Do NOT reserve short windows for the duration-overclaim pairs; a short study window must be just as common under a clean premise.
  - Invent FICTIONAL sources: realistic titles, author surnames, years 2005-2023, 2-4 sentence abstracts, 2-3 key findings. Vary domains (medicine, economics, climate, psychology, CS, education).

Output ONLY a JSON object:
{ "pairs": [ { "failureMode": "a"|"b"|"c"|"d"|"e", "source": { "title": "...", "authors": ["Surname A.","Surname B."], "publishedAt": "YYYY-01-01", "abstract": "...", "keyFindings": ["...","..."] }, "cleanPremise": "...", "overclaimPremise": "..." }, ... ] }
No prose. Exactly the count of pairs requested.`;

// obvious_error is the FLOOR check (unpaired) — but still surface-matched so it
// isn't identifiable by shape, only by the blatant topic/finding mismatch.
const OBVIOUS_SYSTEM = `You generate "obvious_error" items for an evidence-fidelity benchmark — the FLOOR check (every panel should catch these). Each item is a factual PREMISE paired with a CITED SOURCE whose abstract obviously does NOT support it: a blatant mismatch any careful reader catches (wrong topic, opposite finding, unrelated field).

Keep the abstract JUST as concrete as the other item kinds — name a study design, an explicit study window (mix short and long across items), a population, and an outcome, and use correlational or causal framing — so obvious_error is NOT distinguishable from the other kinds by surface shape, only by the blatant topic/finding mismatch. It is a real-looking study about the WRONG thing.

Invent FICTIONAL sources: realistic titles, author surnames, years 2005-2023, 2-4 sentence abstracts, 2-3 key findings. Vary domains (medicine, economics, climate, psychology, CS, education).

Output ONLY a JSON object:
{ "items": [ { "premiseText": "...", "source": { "title": "...", "authors": ["Surname A."], "publishedAt": "YYYY-01-01", "abstract": "...", "keyFindings": ["..."] } }, ... ] }
No prose. Exactly the count requested.`;

function normalizeSource(s: any): SourceLite {
  return {
    title: String(s?.title ?? "(untitled)"),
    authors: Array.isArray(s?.authors) ? s.authors.map(String) : [],
    publishedAt: s?.publishedAt ? String(s.publishedAt) : null,
    abstract: s?.abstract ? String(s.abstract) : null,
    keyFindings: Array.isArray(s?.keyFindings) ? s.keyFindings.map(String) : [],
  };
}

const pad = (i: number) => String(i).padStart(3, "0");

/** Generate `count` matched pairs → 2*count items (a clean + a plausible each,
 *  sharing one source, tied by pairId). */
async function generatePairs(gpt: GptClient, count: number): Promise<Item[]> {
  const res = await gpt.chat({
    system: PAIR_SYSTEM,
    user: `Produce ${count} matched pairs. Rotate the overclaim dimension (a-e) roughly evenly across pairs. Both premises in a pair share one source and differ ONLY in the source-relationship.`,
    model: MODELS.gpt,
    temperature: 0.9,
    maxTokens: 16000,
    jsonMode: true,
  });
  const parsed = extractJson(res.text);
  const pairs: any[] = Array.isArray(parsed?.pairs) ? parsed.pairs : [];
  const items: Item[] = [];
  pairs.forEach((p, i) => {
    const pairId = `pair-${pad(i)}`;
    const source = normalizeSource(p.source);
    items.push({
      id: `clean_correct-${pad(i)}`,
      itemType: "clean_correct",
      generatorFamily: "gpt",
      premiseText: String(p.cleanPremise ?? ""),
      citationToken: "S1",
      source: { ...source }, // clone so each item record is self-contained
      groundTruthError: null,
      pairId,
    });
    items.push({
      id: `plausible_correlated-${pad(i)}`,
      itemType: "plausible_correlated",
      generatorFamily: "gpt",
      premiseText: String(p.overclaimPremise ?? ""),
      citationToken: "S1",
      source: { ...source },
      groundTruthError: null,
      pairId,
      overclaimDimension: String(p.failureMode ?? ""),
    });
  });
  return items;
}

async function generateObvious(gpt: GptClient, count: number): Promise<Item[]> {
  const res = await gpt.chat({
    system: OBVIOUS_SYSTEM,
    user: `Produce ${count} obvious_error items.`,
    model: MODELS.gpt,
    temperature: 0.9,
    maxTokens: 16000,
    jsonMode: true,
  });
  const parsed = extractJson(res.text);
  const raw: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
  return raw.map((r, i) => ({
    id: `obvious_error-${pad(i)}`,
    itemType: "obvious_error" as const,
    generatorFamily: "gpt" as const,
    premiseText: String(r.premiseText ?? ""),
    citationToken: "S1",
    source: normalizeSource(r.source),
    groundTruthError: null,
  }));
}

// ---------------------------------------------------------------------------
// Surface-match audit. The pilot's first item bank leaked the item type through
// the abstract's SHAPE: ~90% of plausible_correlated abstracts stated a short
// study window and 0% of clean_correct did, so a checker could pattern-match
// "short duration → overclaim" without reasoning — diluting the measurement and
// biasing R toward a false "no gap". This audit runs on every generation and
// warns if any surface feature predicts the item type, so the tell can't come
// back silently. Regexes match the offline analysis that first caught it.
// ---------------------------------------------------------------------------
const DURATION_RE =
  /(\b\d+\s*-?\s*(day|week|month)s?\b)|(\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)[- ](day|week|month)s?\b)|month-long|single semester|single season|immediately (after|following)|post-session/i;
const CORRELATION_RE = /(correlat|associat|\blink(ed|s)?\b|observational|cross-sectional)/i;

const ALL_TYPES: ItemType[] = ["clean_correct", "obvious_error", "plausible_correlated"];

function surfaceText(it: Item): string {
  return (it.source.abstract ?? "") + " " + (it.source.keyFindings ?? []).join(" ");
}

/** Prints a per-type table and warns if a surface feature predicts the type. */
function auditSurfaceMatch(items: Item[]): void {
  const SPREAD_WARN = 0.4; // >40pp gap between types = a usable shortcut
  const rows = ALL_TYPES.map((t) => {
    const xs = items.filter((i) => i.itemType === t);
    const dur = xs.filter((i) => DURATION_RE.test(surfaceText(i))).length;
    const corr = xs.filter((i) => CORRELATION_RE.test(surfaceText(i))).length;
    return { t, n: xs.length, dur, corr };
  });

  const pct = (a: number, n: number) => (n ? Math.round((100 * a) / n) + "%" : "-");
  console.log("\nSurface-match audit (no surface feature should predict the item type):");
  console.log("  type                    n   short-duration   correlation-framing");
  for (const r of rows) {
    console.log(
      "  " + r.t.padEnd(22),
      String(r.n).padStart(2),
      "  ",
      (r.dur + "/" + r.n).padEnd(7),
      pct(r.dur, r.n).padStart(4),
      "  ",
      (r.corr + "/" + r.n).padEnd(7),
      pct(r.corr, r.n).padStart(4),
    );
  }

  const PAIR_WARN = 0.15; // clean vs plausible must be ~0 under matched pairs
  const get = (t: ItemType) => rows.find((r) => r.t === t)!;
  const cc = get("clean_correct");
  const pc = get("plausible_correlated");
  const rate = (r: (typeof rows)[number], k: "dur" | "corr") => (r.n ? r[k] / r.n : 0);
  const pairDur = Math.abs(rate(cc, "dur") - rate(pc, "dur"));
  const pairCorr = Math.abs(rate(cc, "corr") - rate(pc, "corr"));

  console.log(
    `  measurement pair (clean vs plausible): duration Δ${Math.round(100 * pairDur)}pp, ` +
      `correlation Δ${Math.round(100 * pairCorr)}pp  — must be ~0 under matched pairs`,
  );

  // Critical: the clean↔plausible pair is what the measurement rests on. A gap
  // here means the twins are NOT actually surface-matched (usually a pairing
  // failure) and the tell is back on the discriminative comparison.
  if (pairDur > PAIR_WARN || pairCorr > PAIR_WARN) {
    console.log("\n  ⚠ MEASUREMENT PAIR NOT SURFACE-MATCHED — the clean vs plausible tell is back.");
    console.log("    The twins should share a source; check the paired-integrity line below. Regenerate before running panels.");
    return;
  }

  // Softer: obvious_error (the floor) diverging from the paired items doesn't
  // bias the clean-vs-plausible measurement, but even it out for cleanliness.
  const oe = get("obvious_error");
  const oeDur = Math.max(Math.abs(rate(oe, "dur") - rate(cc, "dur")), Math.abs(rate(oe, "dur") - rate(pc, "dur")));
  const oeCorr = Math.max(Math.abs(rate(oe, "corr") - rate(cc, "corr")), Math.abs(rate(oe, "corr") - rate(pc, "corr")));
  if (oeDur > SPREAD_WARN || oeCorr > SPREAD_WARN) {
    console.log("\n  ⚠ obvious_error diverges on surface shape from the paired items (floor items only —");
    console.log("    does not bias the clean-vs-plausible measurement, but regenerate for full surface parity).");
  } else {
    console.log("\n  ✓ measurement pair surface-matched and obvious_error in line (no surface tell).");
  }
}

/** Warns if any pair is missing a twin or the twins don't share their source. */
function auditPairing(items: Item[]): void {
  const byPair = new Map<string, Item[]>();
  for (const it of items) {
    if (!it.pairId) continue;
    const arr = byPair.get(it.pairId) ?? [];
    arr.push(it);
    byPair.set(it.pairId, arr);
  }
  let complete = 0;
  const broken: string[] = [];
  for (const [pid, xs] of byPair) {
    const clean = xs.find((x) => x.itemType === "clean_correct");
    const plaus = xs.find((x) => x.itemType === "plausible_correlated");
    if (clean && plaus && clean.source.abstract && clean.source.abstract === plaus.source.abstract) {
      complete++;
    } else {
      broken.push(pid);
    }
  }
  console.log(
    `\nPaired-integrity: ${complete} complete pairs (clean+plausible share one source)` +
      (broken.length ? `; ⚠ ${broken.length} broken: ${broken.slice(0, 5).join(", ")}` : "."),
  );
  if (broken.length) console.log("  A broken pair means the generator didn't reuse the source — regenerate or hand-fix.");
}

async function main() {
  const perType = Number(process.argv.find((a) => a.startsWith("--per-type="))?.split("=")[1] ?? 30);
  const gpt = new GptClient();
  mkdirSync(DATA_DIR, { recursive: true });

  process.stdout.write(`generating ${perType} matched pairs (→ ${perType} clean + ${perType} plausible) ... `);
  const paired = await generatePairs(gpt, perType);
  console.log(`${paired.length} items ok`);

  process.stdout.write(`generating ${perType} × obvious_error ... `);
  const obvious = await generateObvious(gpt, perType);
  console.log(`${obvious.length} ok`);

  const all: Item[] = [...paired, ...obvious];

  auditSurfaceMatch(all);
  auditPairing(all);

  const out = join(DATA_DIR, "items.raw.json");
  writeFileSync(out, JSON.stringify(all, null, 2));
  console.log(`\nWrote ${all.length} unlabelled items → ${out}`);
  console.log(`Next: tsx experiments/R-blind-spot/human-sheets.ts --mode=filter  (human ground-truth pass)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
