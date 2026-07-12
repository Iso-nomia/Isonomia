/**
 * experiments/R-blind-spot/human-apply.ts
 *
 *   --mode=filter : join filter-input.csv onto items.raw.json → items.json
 *                   (ground-truth-labelled, dropped items removed).
 *   --mode=panel  : read panel-input.<rater>.csv → human CheckerVerdicts appended
 *                   to human-verdicts.json. Each rater is one panel member.
 *
 *   Run: tsx experiments/R-blind-spot/human-apply.ts --mode=filter
 *        tsx experiments/R-blind-spot/human-apply.ts --mode=panel --rater=alice
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fromCsv } from "./csv";
import { isCatch } from "./judge";
import type { Item, PoolVerdict, VerdictClass } from "./types";

const DATA_DIR = join(__dirname, "data");
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const mode = (arg("mode") ?? "filter") as "filter" | "panel";

function applyFilter() {
  const items: Item[] = JSON.parse(readFileSync(join(DATA_DIR, "items.raw.json"), "utf8"));
  const rows = fromCsv(readFileSync(join(DATA_DIR, "filter-input.csv"), "utf8"));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const labelled: Item[] = [];
  let dropped = 0;
  for (const it of items) {
    const r = byId.get(it.id);
    if (!r || r.drop === "1" || r.groundTruthError === "") { dropped++; continue; }
    labelled.push({
      ...it,
      groundTruthError: r.groundTruthError === "1",
      filterNote: r.note || undefined,
    });
  }
  writeFileSync(join(DATA_DIR, "items.json"), JSON.stringify(labelled, null, 2));
  const errs = labelled.filter((i) => i.groundTruthError).length;
  console.log(`Wrote data/items.json: ${labelled.length} labelled (${errs} errors, ${labelled.length - errs} clean), ${dropped} dropped.`);
}

function applyPanel() {
  const rater = arg("rater");
  if (!rater) throw new Error("--rater=<name> is required in panel mode");
  const items: Item[] = JSON.parse(readFileSync(join(DATA_DIR, "items.json"), "utf8"));
  const known = new Set(items.map((i) => i.id));
  const rows = fromCsv(readFileSync(join(DATA_DIR, `panel-input.${rater}.csv`), "utf8"));

  const outPath = join(DATA_DIR, "human-verdicts.json");
  const existing: PoolVerdict[] = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
  // Drop any prior verdicts from this rater (re-apply is idempotent).
  const kept = existing.filter((v) => v.checkerId !== `human:${rater}`);

  const VALID = new Set(["supported", "partial", "not_supported", "uncertain"]);
  const added: PoolVerdict[] = [];
  for (const r of rows) {
    if (!known.has(r.id)) continue;
    const v = r.verdict.toLowerCase();
    if (!VALID.has(v)) continue;
    added.push({
      itemId: r.id,
      family: "human",
      modelVersion: `human:${rater}`,
      checkerId: `human:${rater}`,
      verdict: v as VerdictClass,
      justification: r.justification ?? "",
      caught: isCatch(v as VerdictClass),
    });
  }
  writeFileSync(outPath, JSON.stringify([...kept, ...added], null, 2));
  console.log(`Rater "${rater}": ${added.length} verdicts recorded → data/human-verdicts.json`);
}

if (mode === "filter") applyFilter();
else applyPanel();
