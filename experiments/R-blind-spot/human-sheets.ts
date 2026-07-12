/**
 * experiments/R-blind-spot/human-sheets.ts
 *
 * Generates the human-facing sheets. Two modes:
 *
 *   --mode filter : GROUND-TRUTH labelling pass over items.raw.json. The labeller
 *                   MAY see the intended itemType; their job is to set the true
 *                   groundTruthError and drop tells/ambiguous items. This defines
 *                   ground truth — it is NOT a blind check.
 *
 *   --mode panel  : the BLIND human panel. Sheet shows ONLY premise + source
 *                   (no itemType, no ground truth), and asks for the same verdict
 *                   vocabulary the model judges use. This is the difficulty
 *                   control (R) and the competence readout (R-H). Ordering is
 *                   PAIR-AWARE: matched twins (a clean_correct + its
 *                   plausible_correlated sharing one source) are pushed into
 *                   opposite halves so a human can't reason comparatively across
 *                   them; item types stay evenly mixed across positions.
 *
 * IMPORTANT: a person who did the filter pass on an item must NOT be a panel
 * rater on that same item — they already know the answer. Keep the roles (and
 * ideally the people) disjoint.
 *
 *   Run: tsx experiments/R-blind-spot/human-sheets.ts --mode panel
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toCsv } from "./csv";
import type { Item } from "./types";

const DATA_DIR = join(__dirname, "data");
const mode = (process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "filter") as
  | "filter"
  | "panel";

// Deterministic shuffle (seeded) so re-runs are stable and no Math.random.
function shuffle<T>(arr: T[], seed = 1013904223): T[] {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pair-aware blind ordering. Matched twins (a clean_correct and its
 * plausible_correlated) cite the SAME source, so a human rater who sees them
 * close together could reason comparatively instead of independently. This
 * puts the two members of every pair in OPPOSITE HALVES of the sheet (so they
 * are ~n/2 apart), with a seam guard against boundary-adjacency, while keeping
 * each item type evenly mixed across positions (no rater-fatigue confound from,
 * say, all the hard items landing late). AI panels see each item in a fresh
 * context, so this matters only for the human arm — but it is free to enforce.
 */
function pairAwareOrder<T extends { id: string; pairId?: string; itemType: string }>(
  items: T[],
  seed = 1013904223,
): T[] {
  const shuffled = shuffle(items, seed);

  // Group into pairs (insertion order = shuffle order) and unpaired items.
  const pairs = new Map<string, T[]>();
  const unpaired: T[] = [];
  for (const it of shuffled) {
    if (!it.pairId) { unpaired.push(it); continue; }
    const arr = pairs.get(it.pairId) ?? [];
    arr.push(it);
    pairs.set(it.pairId, arr);
  }

  const A: T[] = [];
  const B: T[] = [];
  // For each pair send one twin to each half, ALTERNATING which TYPE leads into
  // A. Keying on type (not shuffle position) is what keeps each half's type mix
  // balanced — otherwise the measurement (plausible) items can pile into one
  // half and confound rater fatigue with type.
  let toggle = false;
  for (const members of pairs.values()) {
    const clean = members.find((m) => m.itemType === "clean_correct");
    const plaus = members.find((m) => m.itemType === "plausible_correlated");
    if (clean && plaus) {
      if (toggle) { A.push(clean); B.push(plaus); } else { A.push(plaus); B.push(clean); }
      toggle = !toggle;
    } else {
      for (const m of members) { (toggle ? B : A).push(m); toggle = !toggle; }
    }
  }
  // Unpaired (obvious_error) split evenly across halves.
  let flip = false;
  for (const it of unpaired) { (flip ? B : A).push(it); flip = !flip; }

  // Shuffle within each half so the A/B assignment imposes no order.
  const As = shuffle(A, (seed ^ 0x9e3779b9) >>> 0);
  const Bs = shuffle(B, (seed ^ 0x7f4a7c15) >>> 0);
  // Seam guard: if the last of A and the first of B are twins, swap B[0] with a
  // distant element (which cannot be A-last's unique partner) to break it.
  if (As.length && Bs.length) {
    const lastPair = As[As.length - 1].pairId;
    if (lastPair && lastPair === Bs[0].pairId) {
      const mid = Math.floor(Bs.length / 2);
      [Bs[0], Bs[mid]] = [Bs[mid], Bs[0]];
    }
  }
  return [...As, ...Bs];
}

/** Smallest position gap between any two matched twins (Infinity if no pairs). */
function minTwinGap<T extends { pairId?: string }>(ordered: T[]): number {
  const pos = new Map<string, number[]>();
  ordered.forEach((it, i) => {
    if (!it.pairId) return;
    const arr = pos.get(it.pairId) ?? [];
    arr.push(i);
    pos.set(it.pairId, arr);
  });
  let min = Infinity;
  for (const idxs of pos.values()) {
    if (idxs.length === 2) min = Math.min(min, Math.abs(idxs[0] - idxs[1]));
  }
  return min;
}

function renderItemMd(item: Item, showType: boolean): string {
  const s = item.source;
  const yr = s.publishedAt ? s.publishedAt.slice(0, 4) : "n.d.";
  const authors = s.authors.length ? s.authors.join(", ") : "Anonymous";
  const lines = [
    `### ${item.id}${showType ? `  _(${item.itemType})_` : ""}`,
    ``,
    `**Premise:** ${item.premiseText}`,
    ``,
    `**Cited source (${item.citationToken}):** ${authors} (${yr}). ${s.title}`,
    ``,
    `> ${s.abstract ?? "(no abstract on record)"}`,
  ];
  if (s.keyFindings.length) {
    lines.push(``, `Key findings:`);
    for (const f of s.keyFindings) lines.push(`- ${f}`);
  }
  lines.push(``);
  return lines.join("\n");
}

function main() {
  const items: Item[] = JSON.parse(readFileSync(join(DATA_DIR, "items.raw.json"), "utf8"));

  if (mode === "filter") {
    const md = [
      `# R pilot — ground-truth filter sheet`,
      ``,
      `For each item set **groundTruthError** in filter-input.csv: \`1\` if the source genuinely does NOT support the premise (a real error), \`0\` if it genuinely does. Set **drop**=\`1\` for any item that is ambiguous, or whose error is only detectable via a generation "tell" rather than substance. Add a short **note** for plausible_correlated items on WHY it is wrong-but-plausible.`,
      ``,
      ...items.map((it) => renderItemMd(it, true)),
    ].join("\n");
    writeFileSync(join(DATA_DIR, "filter-sheet.md"), md);
    writeFileSync(
      join(DATA_DIR, "filter-input.csv"),
      toCsv(items.map((it) => ({ id: it.id, groundTruthError: "", drop: "", note: "" })), [
        "id",
        "groundTruthError",
        "drop",
        "note",
      ]),
    );
    console.log(`Wrote data/filter-sheet.md + data/filter-input.csv (${items.length} items).`);
    console.log(`Fill the CSV, then: tsx experiments/R-blind-spot/human-apply.ts --mode=filter`);
    return;
  }

  // panel mode — blind + pair-aware order, no itemType shown.
  const shuffled = pairAwareOrder(items);
  const md = [
    `# R pilot — blind panel sheet`,
    ``,
    `You are reviewing (premise, cited source) pairs. For each, judge whether the SOURCE actually supports the PREMISE as stated — not whether the premise is true in the world. Put your verdict in panel-input.csv, one of: \`supported\`, \`partial\`, \`not_supported\`, \`uncertain\` (use uncertain only if the source data is genuinely too thin). Add a one-line justification.`,
    ``,
    `**Rate each item independently.** Some sources may look familiar — do not page back to compare items against each other; judge each one only on whether that source supports that premise.`,
    ``,
    ...shuffled.map((it) => renderItemMd(it, false)),
  ].join("\n");
  writeFileSync(join(DATA_DIR, "panel-sheet.md"), md);
  writeFileSync(
    join(DATA_DIR, "panel-input.template.csv"),
    toCsv(shuffled.map((it) => ({ id: it.id, verdict: "", justification: "" })), [
      "id",
      "verdict",
      "justification",
    ]),
  );
  const gap = minTwinGap(shuffled);
  console.log(
    `Wrote data/panel-sheet.md + data/panel-input.template.csv (${shuffled.length} items, blind, pair-aware order` +
      (Number.isFinite(gap) ? `; matched twins ≥ ${gap} positions apart).` : `).`),
  );
  console.log(`Give each rater a COPY of the template as panel-input.<rater>.csv, then:`);
  console.log(`  tsx experiments/R-blind-spot/human-apply.ts --mode=panel --rater=<name>`);
}

main();
