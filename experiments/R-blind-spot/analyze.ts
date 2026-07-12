/**
 * experiments/R-blind-spot/analyze.ts
 *
 * Composes arms from the flat verdict pool and emits the R read-out:
 *  - catch rate per (arm, itemType), with false-positive rate on clean controls;
 *  - the same-family-vs-cross-family curve on plausible_correlated items;
 *  - the N=2 contrast (does the 2nd checker's FAMILY matter?);
 *  - the indicting cell (high human catch AND low all-Claude catch, same items);
 *  - R-H: per-human catch rate on plausible_correlated (competence readout);
 *  - the refutation verdict (curves overlap ⇒ correlation isn't biting ⇒ collapse).
 *
 * M-1 guard: ground truth is human-filtered, so this measures AI-blindness-
 * BEYOND-human-blindness — a GAP, never an absolute floor. If the human arm is
 * missing, that gap is unmeasurable and the report says so loudly.
 *
 *   Run: tsx experiments/R-blind-spot/analyze.ts
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Item, ItemType, PoolVerdict } from "./types";

const DATA_DIR = join(__dirname, "data");
const TYPES: ItemType[] = ["clean_correct", "obvious_error", "plausible_correlated"];

// AI arm compositions, as member checkerIds drawn from the pool.
const AI_ARMS: Record<string, string[]> = {
  claude_1: ["claude:0"],
  claude_2: ["claude:0", "claude:1"],
  claude_3: ["claude:0", "claude:1", "claude:2"],
  cross_2: ["claude:0", "gpt:0"],
  cross_3: ["claude:0", "gpt:0", "gpt:1"],
};

function pct(x: number): string {
  return `${(100 * x).toFixed(1)}%`;
}

function main() {
  const items: Item[] = JSON.parse(readFileSync(join(DATA_DIR, "items.json"), "utf8"));
  const ai: PoolVerdict[] = JSON.parse(readFileSync(join(DATA_DIR, "ai-verdicts.json"), "utf8"));
  const humanPath = join(DATA_DIR, "human-verdicts.json");
  const human: PoolVerdict[] = existsSync(humanPath) ? JSON.parse(readFileSync(humanPath, "utf8")) : [];
  const humanRaters = [...new Set(human.map((v) => v.checkerId))];

  // Index verdicts by item → checkerId → caught.
  const caughtBy = new Map<string, Map<string, boolean>>();
  for (const v of [...ai, ...human]) {
    if (!caughtBy.has(v.itemId)) caughtBy.set(v.itemId, new Map());
    caughtBy.get(v.itemId)!.set(v.checkerId, v.caught);
  }

  const errorItemsByType = (t: ItemType) => items.filter((i) => i.itemType === t && i.groundTruthError === true);
  const cleanItemsByType = (t: ItemType) => items.filter((i) => i.itemType === t && i.groundTruthError === false);

  // ≥1-member panel catch. members = checkerIds; human panel = all raters.
  const panelCaught = (itemId: string, members: string[]): boolean => {
    const m = caughtBy.get(itemId);
    if (!m) return false;
    return members.some((id) => m.get(id) === true);
  };

  const arms: Array<{ key: string; members: string[] }> = [
    ...Object.entries(AI_ARMS).map(([key, members]) => ({ key, members })),
  ];
  if (humanRaters.length) arms.push({ key: "human", members: humanRaters });

  // catch rate + false-positive rate per (arm, itemType).
  type Cell = { catchRate: number; nErr: number; fpRate: number; nClean: number };
  const table: Record<string, Record<ItemType, Cell>> = {};
  for (const arm of arms) {
    table[arm.key] = {} as any;
    for (const t of TYPES) {
      const errs = errorItemsByType(t);
      const cleans = cleanItemsByType(t);
      const caught = errs.filter((it) => panelCaught(it.id, arm.members)).length;
      const fp = cleans.filter((it) => panelCaught(it.id, arm.members)).length;
      table[arm.key][t] = {
        catchRate: errs.length ? caught / errs.length : NaN,
        nErr: errs.length,
        fpRate: cleans.length ? fp / cleans.length : NaN,
        nClean: cleans.length,
      };
    }
  }

  // ── Compose the report ────────────────────────────────────────────────
  const L: string[] = [];
  L.push(`# R pilot — read-out`, ``);
  L.push(`Items: ${items.length} (${TYPES.map((t) => `${t}: ${items.filter((i) => i.itemType === t).length}`).join(", ")}).`);
  L.push(`Ground-truth errors: ${items.filter((i) => i.groundTruthError === true).length}; clean: ${items.filter((i) => i.groundTruthError === false).length}.`);
  L.push(`AI checker pool: ${new Set(ai.map((v) => v.checkerId)).size} checkers; human raters: ${humanRaters.length}${humanRaters.length ? ` (${humanRaters.join(", ")})` : ""}.`, ``);

  // Catch-rate table on the measurement cell.
  L.push(`## Catch rate — plausible_correlated (THE measurement)`, ``);
  L.push(`| arm | catch rate | n | false-pos (clean) |`, `|---|---|---|---|`);
  for (const arm of arms) {
    const c = table[arm.key].plausible_correlated;
    const fp = table[arm.key].clean_correct;
    L.push(`| ${arm.key} | ${isNaN(c.catchRate) ? "—" : pct(c.catchRate)} | ${c.nErr} | ${isNaN(fp.fpRate) ? "—" : pct(fp.fpRate)} |`);
  }
  L.push(``);

  // Floor check.
  L.push(`## Floor check — obvious_error (everyone should catch)`, ``);
  L.push(`| arm | catch rate | n |`, `|---|---|---|`);
  for (const arm of arms) {
    const c = table[arm.key].obvious_error;
    L.push(`| ${arm.key} | ${isNaN(c.catchRate) ? "—" : pct(c.catchRate)} | ${c.nErr} |`);
  }
  L.push(``);

  // The curve + the two decisive contrasts.
  const cr = (k: string) => table[k]?.plausible_correlated?.catchRate ?? NaN;
  L.push(`## The decisive comparisons (plausible_correlated)`, ``);
  L.push(`Same-family curve: claude_1 ${pct(cr("claude_1"))} → claude_2 ${pct(cr("claude_2"))} → claude_3 ${pct(cr("claude_3"))}`);
  L.push(`Cross-family curve: cross_2 ${pct(cr("cross_2"))} → cross_3 ${pct(cr("cross_3"))}`, ``);
  const n2gap = cr("cross_2") - cr("claude_2");
  L.push(`**N=2 contrast (does the 2nd checker's family matter?):** cross_2 − claude_2 = ${(100 * n2gap).toFixed(1)} pts.`);
  if (humanRaters.length) {
    const hGap = cr("human") - cr("claude_3");
    L.push(`**Indicting cell (M-1):** human − claude_3 on the same items = ${(100 * hGap).toFixed(1)} pts.`);
  } else {
    L.push(`**Indicting cell (M-1): UNAVAILABLE — no human arm.** Without the human difficulty control this pilot CANNOT distinguish "hard" from "AI-blind". Treat AI-only numbers as a harness shakedown, not the go/no-go.`);
  }
  L.push(``);

  // R-H competence readout.
  if (humanRaters.length) {
    L.push(`## R-H — human competence on plausible_correlated`, ``);
    L.push(`| rater | catch rate | n |`, `|---|---|---|`);
    const errs = errorItemsByType("plausible_correlated");
    for (const rid of humanRaters) {
      const caught = errs.filter((it) => caughtBy.get(it.id)?.get(rid) === true).length;
      L.push(`| ${rid} | ${errs.length ? pct(caught / errs.length) : "—"} | ${errs.length} |`);
    }
    L.push(``, `If per-rater catch rate is near chance, humans are decorrelated-but-incompetent and their heavy independence weight (D-2) is unearned.`, ``);
  }

  // Refutation verdict.
  L.push(`## Verdict`, ``);
  const EPS = 0.1; // 10-pt overlap tolerance; pilot n is small — treat as directional only.
  if (!humanRaters.length) {
    L.push(`**Inconclusive (no human arm).** Per M-1 the go/no-go needs the human difficulty control. Add human verdicts and re-run.`);
  } else if (Math.abs(n2gap) < EPS && Math.abs(cr("cross_3") - cr("claude_3")) < EPS) {
    L.push(`**Directional: curves OVERLAP** (same-family ≈ cross-family within ${100 * EPS} pts). If this holds at scale, correlation isn't biting for these agents → the apparatus is overbuilt → collapse Round 1 and make confirming AI blanket first-class. PILOT n is small — confirm at scale before acting.`);
  } else {
    L.push(`**Directional: GAP present** — cross-family catches plausible_correlated errors that same-family misses (N=2 gap ${(100 * n2gap).toFixed(1)} pts). If this holds at scale, the dangerous quadrant is real for these agents → Round 1's independence weighting is warranted. PILOT n is small — confirm at scale.`);
  }
  L.push(``);
  L.push(`### Caveats baked into this pilot`);
  L.push(`- Single judge (evidence-fidelity) only; the engagement judge is not run.`);
  L.push(`- Generator = GPT, which also sits in the cross-family arm → cross-family may catch its own generation tells (§4 confound). The full run crosses generator×panel family to remove this.`);
  L.push(`- M-1: this measures AI-blindness-BEYOND-human, never an absolute floor.`);

  const md = L.join("\n");
  writeFileSync(join(DATA_DIR, "report.md"), md);
  writeFileSync(join(DATA_DIR, "report.json"), JSON.stringify({ table, humanRaters }, null, 2));
  console.log(md);
  console.log(`\n(written to data/report.md + data/report.json)`);
}

main();
