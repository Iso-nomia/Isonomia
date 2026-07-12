/**
 * auto-accept-review.ts — Iter-3 E2E smoke helper.
 *
 * Reads a phase-N review markdown produced by the orchestrator, marks every
 * `**Verdict:**` line as `[x] accept` with note "smoke: auto-accept", and
 * appends an `**Applied:**` ISO-timestamp line beneath each verdict so the
 * finalize gate is satisfied without manual review.
 *
 * Usage:
 *   npx tsx --env-file=.env experiments/polarization-1-iter3-e2e/scripts/auto-accept-review.ts <path-to-phase-N-review.md>
 */

import { readFileSync, writeFileSync } from "fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: auto-accept-review.ts <path-to-phase-N-review.md>");
  process.exit(1);
}

const text = readFileSync(inputPath, "utf8");
const lines = text.split(/\r?\n/);
const ts = new Date().toISOString();
const out: string[] = [];

const VERDICT = /^\*\*Verdict:\*\*\s*\[ \]\s*accept\s*\[ \]\s*revise\s*\[ \]\s*retract\s*Notes:.*$/;
const APPLIED = /^\*\*Applied:\*\*/;
let appliedCount = 0;
let alreadyApplied = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (VERDICT.test(line)) {
    out.push("**Verdict:** [x] accept  [ ] revise  [ ] retract  Notes: smoke: auto-accept (Iter-3 E2E #4)");
    // Skip a blank line then check for existing Applied
    const next = lines[i + 1];
    const next2 = lines[i + 2];
    if ((next && APPLIED.test(next)) || (next === "" && next2 && APPLIED.test(next2))) {
      alreadyApplied++;
    } else {
      out.push(`**Applied:** ${ts}`);
      appliedCount++;
    }
    continue;
  }
  out.push(line);
}

writeFileSync(inputPath, out.join("\n"));
console.log(`auto-accept: applied ${appliedCount}, already-applied ${alreadyApplied} → ${inputPath}`);
